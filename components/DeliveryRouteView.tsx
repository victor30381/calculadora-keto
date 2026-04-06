import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, functions } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Order, Client } from '../types';
import { useTheme } from './ThemeContext';

interface DeliveryRouteViewProps {
    userId: string;
}

interface DeliveryStop {
    orderId: string;
    clientName: string;
    clientPhone: string;
    address: string;
    items: string;
    total: number;
    deliveryTime: string;
    position: number;
    lat?: number;
    lng?: number;
}

const MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';

// Dynamically load Google Maps script
const loadGoogleMaps = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if ((window as any).google?.maps) {
            resolve();
            return;
        }
        if (!MAPS_API_KEY || MAPS_API_KEY === 'TU_API_KEY_AQUI') {
            reject(new Error('API_KEY_MISSING'));
            return;
        }
        const existingScript = document.getElementById('google-maps-script');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            return;
        }
        const script = document.createElement('script');
        script.id = 'google-maps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places,geometry`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('MAPS_LOAD_FAILED'));
        document.head.appendChild(script);
    });
};

const DeliveryRouteView: React.FC<DeliveryRouteViewProps> = ({ userId }) => {
    const { companyAddress, companyLat, companyLng } = useTheme();

    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [orders, setOrders] = useState<Order[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    
    // Delivery Route custom states
    const [dayOrdersStore, setDayOrdersStore] = useState<Order[]>([]);
    const [deliveredOrdersStore, setDeliveredOrdersStore] = useState<Order[]>([]);
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
    const [editedAddresses, setEditedAddresses] = useState<Record<string, string>>({});
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [tempAddress, setTempAddress] = useState<string>('');

    const [stops, setStops] = useState<DeliveryStop[]>([]);
    const [originAddress, setOriginAddress] = useState<string>(localStorage.getItem('ak_origin_address') || '');
    const [endAddress, setEndAddress] = useState<string>(localStorage.getItem('ak_end_address') || '');
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [isLoadingRoute, setIsLoadingRoute] = useState(false);
    const [routeInfo, setRouteInfo] = useState<{ totalDistance: string; totalDuration: string } | null>(null);
    const [mapsLoaded, setMapsLoaded] = useState(false);

    useEffect(() => {
        if (!originAddress && companyAddress) {
            setOriginAddress(companyAddress);
        }
    }, [companyAddress, originAddress]);
    const [mapsError, setMapsError] = useState<string | null>(null);
    const [optimizeResult, setOptimizeResult] = useState<string | null>(null);
    const [showConfigPanel, setShowConfigPanel] = useState(false);
    
    const prevDateRef = useRef(selectedDate);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<google.maps.Marker[]>([]);
    const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

    // Load Google Maps
    useEffect(() => {
        loadGoogleMaps()
            .then(() => setMapsLoaded(true))
            .catch((err) => {
                if (err.message === 'API_KEY_MISSING') {
                    setMapsError('API_KEY_MISSING');
                } else {
                    setMapsError('MAPS_LOAD_FAILED');
                }
            });
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapsLoaded || !mapRef.current || mapInstanceRef.current) return;

        const map = new google.maps.Map(mapRef.current, {
            center: { lat: -34.6037, lng: -58.3816 }, // Buenos Aires default
            zoom: 12,
            styles: [
                { elementType: 'geometry', stylers: [{ color: '#f5f0eb' }] },
                { elementType: 'labels.text.fill', stylers: [{ color: '#5D3A29' }] },
                { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f0eb' }] },
                { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#e8ddd3' }] },
                { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#d4c5b5' }] },
                { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#D4A373' }] },
                { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d6df' }] },
                { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#cde0c9' }] },
                { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            ],
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
        });
        mapInstanceRef.current = map;

        const renderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#5D3A29',
                strokeOpacity: 0.8,
                strokeWeight: 4,
            },
        });
        renderer.setMap(map);
        directionsRendererRef.current = renderer;
    }, [mapsLoaded]);

    // Fetch orders & clients
    useEffect(() => {
        if (!userId) return;

        const qOrders = query(collection(db, 'orders'), where('userId', '==', userId));
        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
            setOrders(data);
        });

        const qClients = query(collection(db, 'clients'), where('userId', '==', userId));
        const unsubClients = onSnapshot(qClients, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setClients(data);
        });

        return () => { unsubOrders(); unsubClients(); };
    }, [userId]);

    // Extract day variables into computed properties for the view
    useEffect(() => {
        if (!selectedDate) return;
        const [y, m, d] = selectedDate.split('-').map(Number);
        
        const dayOrd = orders.filter(o => {
            const od = o.deliveryDate && typeof (o.deliveryDate as any).toDate === 'function'
                ? (o.deliveryDate as any).toDate()
                : new Date(o.deliveryDate);
            if (!od || isNaN(od.getTime())) return false;
            return od.getDate() === d && od.getMonth() === m - 1 && od.getFullYear() === y
                && o.status === 'pending';
        });
        setDayOrdersStore(dayOrd);

        const deliveredOrd = orders.filter(o => {
            const od = o.deliveryDate && typeof (o.deliveryDate as any).toDate === 'function'
                ? (o.deliveryDate as any).toDate()
                : new Date(o.deliveryDate);
            if (!od || isNaN(od.getTime())) return false;
            return od.getDate() === d && od.getMonth() === m - 1 && od.getFullYear() === y
                && o.status === 'delivered';
        });
        setDeliveredOrdersStore(deliveredOrd);
        
        // Setup initial default selection
        if (selectedDate !== prevDateRef.current || (dayOrd.length > 0 && selectedOrderIds.length === 0)) {
            const withAddr = dayOrd.filter(o => {
                const c = clients.find(cl => cl.id === o.clientId);
                const a = (o as any).clientAddress || c?.address || '';
                return a.trim() !== '';
            }).map(o => o.id);

            if (selectedDate !== prevDateRef.current) {
                setSelectedOrderIds(withAddr);
                prevDateRef.current = selectedDate;
                setRouteInfo(null);
                setOptimizeResult(null);
            } else if (selectedOrderIds.length === 0 && withAddr.length > 0) {
                setSelectedOrderIds(withAddr);
            }
        }
    }, [selectedDate, orders, clients, selectedOrderIds.length]);

    // Build stops from SELECTED dayOrders
    useEffect(() => {
        const newStops: DeliveryStop[] = dayOrdersStore
            .filter(o => selectedOrderIds.includes(o.id))
            .map((order, idx) => {
                const client = clients.find(c => c.id === order.clientId);
                const originalAddr = (order as any).clientAddress || client?.address || '';
                const address = editedAddresses[order.id] || originalAddr;
                return {
                    orderId: order.id,
                    clientName: order.clientName,
                    clientPhone: (order as any).clientPhone || client?.phone || '',
                    address,
                    items: order.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
                    total: order.total,
                    deliveryTime: order.deliveryTime || '',
                    position: idx + 1,
                };
            })
            .filter(s => s.address.trim() !== '');

        setStops(newStops);
    }, [dayOrdersStore, clients, selectedOrderIds, editedAddresses]);

    // Address & Selection handlers
    const toggleOrderSelection = (orderId: string) => {
        setSelectedOrderIds(prev => 
            prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
        );
        setRouteInfo(null);
    };

    const saveEditedAddress = (orderId: string) => {
        setEditedAddresses(prev => ({ ...prev, [orderId]: tempAddress }));
        setEditingAddressId(null);
        setRouteInfo(null);
    };

    // Update markers when stops change
    useEffect(() => {
        if (!mapsLoaded || !mapInstanceRef.current) return;

        // Clear existing markers
        markersRef.current.forEach(m => m.setMap(null));
        markersRef.current = [];

        if (stops.length === 0 && !originAddress) return;

        const geocoder = new google.maps.Geocoder();
        const bounds = new google.maps.LatLngBounds();
        let geocoded = 0;
        const totalToGeocode = stops.length + (originAddress ? 1 : 0);

        const checkBounds = () => {
            if (geocoded === totalToGeocode && totalToGeocode > 0) {
                mapInstanceRef.current?.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
                // Si solo hay un marcador (ej. el origen), evitar hacer demasiado zoom in
                if (totalToGeocode === 1) {
                    mapInstanceRef.current?.setZoom(15);
                }
            }
        };

        if (originAddress) {
            const isCompanyDefault = (originAddress === companyAddress || originAddress === 'Alternativa Keto') && companyLat && companyLng;
            if (isCompanyDefault) {
                const location = new google.maps.LatLng(companyLat!, companyLng!);
                const originMarker = new google.maps.Marker({
                    position: location,
                    map: mapInstanceRef.current!,
                    icon: {
                        url: '/logo.png',
                        scaledSize: new google.maps.Size(46, 46),
                        origin: new google.maps.Point(0, 0),
                        anchor: new google.maps.Point(23, 23),
                    },
                    title: 'Alternativa Keto (Local)',
                    zIndex: 999,
                });
                markersRef.current.push(originMarker);
                bounds.extend(location);
                geocoded++;
                checkBounds();
            } else {
                geocoder.geocode({ address: originAddress, componentRestrictions: { country: 'AR' } }, (results, status) => {
                    if (status === 'OK' && results && results[0]) {
                        const location = results[0].geometry.location;
                        const originMarker = new google.maps.Marker({
                            position: location,
                            map: mapInstanceRef.current!,
                            icon: {
                                url: '/logo.png',
                                scaledSize: new google.maps.Size(46, 46),
                                origin: new google.maps.Point(0, 0),
                                anchor: new google.maps.Point(23, 23),
                            },
                            title: 'Alternativa Keto (Local)',
                            zIndex: 999,
                        });
                        markersRef.current.push(originMarker);
                        bounds.extend(location);
                    }
                    geocoded++;
                    checkBounds();
                });
            }
        }

        stops.forEach((stop, idx) => {
            geocoder.geocode({ address: stop.address, componentRestrictions: { country: 'AR' } }, (results, status) => {
                if (status === 'OK' && results && results[0]) {
                    const location = results[0].geometry.location;
                    stop.lat = location.lat();
                    stop.lng = location.lng();

                    const marker = new google.maps.Marker({
                        position: location,
                        map: mapInstanceRef.current!,
                        label: {
                            text: String(stop.position),
                            color: '#FFFFFF',
                            fontWeight: 'bold',
                            fontSize: '14px',
                        },
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            fillColor: '#5D3A29',
                            fillOpacity: 1,
                            strokeColor: '#D4A373',
                            strokeWeight: 3,
                            scale: 18,
                        },
                        title: `${stop.position}. ${stop.clientName}`,
                    });

                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div style="font-family: 'Inter', sans-serif; padding: 8px; max-width: 200px;">
                                <div style="font-weight: 800; color: #5D3A29; font-size: 14px; margin-bottom: 4px;">
                                    ${stop.position}. ${stop.clientName}
                                </div>
                                <div style="color: #888; font-size: 12px; margin-bottom: 4px;">${stop.address}</div>
                                <div style="color: #5D3A29; font-size: 11px;">${stop.items}</div>
                                ${stop.clientPhone ? `<div style="color: #D4A373; font-size: 11px; margin-top: 4px;">📞 ${stop.clientPhone}</div>` : ''}
                            </div>
                        `,
                    });

                    marker.addListener('click', () => {
                        infoWindow.open(mapInstanceRef.current!, marker);
                    });

                    markersRef.current.push(marker);
                    bounds.extend(location);
                }

                geocoded++;
                checkBounds();
            });
        });
    }, [stops, mapsLoaded, originAddress]);

    // Save addresses to localStorage
    const saveOrigin = (value: string) => {
        setOriginAddress(value);
        localStorage.setItem('ak_origin_address', value);
    };
    const saveEnd = (value: string) => {
        setEndAddress(value);
        localStorage.setItem('ak_end_address', value);
    };

    // Draw route on map
    const drawRoute = useCallback((orderedStops: DeliveryStop[]) => {
        if (!mapsLoaded || !mapInstanceRef.current || !directionsRendererRef.current) return;
        if (orderedStops.length < 1) return;

        setIsLoadingRoute(true);
        const directionsService = new google.maps.DirectionsService();

        const origin = originAddress || orderedStops[0].address;
        
        const isOriginCompanyDefault = (originAddress === companyAddress || originAddress === 'Alternativa Keto') && companyLat && companyLng;
        const routeOrigin: string | google.maps.LatLng = isOriginCompanyDefault ? new google.maps.LatLng(companyLat!, companyLng!) : origin;

        const isDestCompanyDefault = endAddress && (endAddress === companyAddress || endAddress === 'Alternativa Keto') && companyLat && companyLng;
        const routeDestination: string | google.maps.LatLng = isDestCompanyDefault ? new google.maps.LatLng(companyLat!, companyLng!) : (endAddress ? endAddress : routeOrigin);

        const waypoints = orderedStops.map(s => ({
            location: s.address,
            stopover: true,
        }));

        directionsService.route(
            {
                origin: routeOrigin,
                destination: routeDestination,
                waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false, // We use our own IA optimization
                region: 'AR',
            },
            (result, status) => {
                setIsLoadingRoute(false);
                if (status === 'OK' && result) {
                    directionsRendererRef.current!.setDirections(result);

                    // Clear custom markers since directions renderer will show route
                    markersRef.current.forEach(m => m.setMap(null));
                    markersRef.current = [];

                    // Re-add numbered markers along the route
                    const route = result.routes[0];
                    if (route.legs) {
                        let totalDist = 0;
                        let totalDur = 0;

                        // Origin marker
                        const originLeg = route.legs[0];
                        if (originLeg.start_location) {
                            const originMarker = new google.maps.Marker({
                                position: originLeg.start_location,
                                map: mapInstanceRef.current!,
                                icon: {
                                    url: '/logo.png',
                                    scaledSize: new google.maps.Size(46, 46),
                                    origin: new google.maps.Point(0, 0),
                                    anchor: new google.maps.Point(23, 23),
                                },
                                title: 'Alternativa Keto (Local)',
                                zIndex: 999,
                            });
                            markersRef.current.push(originMarker);
                        }

                        route.legs.forEach((leg, i) => {
                            totalDist += leg.distance?.value || 0;
                            totalDur += leg.duration?.value || 0;

                            // Stop markers (at end of each leg except the last which is destination)
                            if (i < orderedStops.length) {
                                const stop = orderedStops[i];
                                const marker = new google.maps.Marker({
                                    position: leg.end_location,
                                    map: mapInstanceRef.current!,
                                    label: {
                                        text: String(i + 1),
                                        color: '#FFFFFF',
                                        fontWeight: 'bold',
                                        fontSize: '14px',
                                    },
                                    icon: {
                                        path: google.maps.SymbolPath.CIRCLE,
                                        fillColor: '#5D3A29',
                                        fillOpacity: 1,
                                        strokeColor: '#D4A373',
                                        strokeWeight: 3,
                                        scale: 18,
                                    },
                                    title: `${i + 1}. ${stop.clientName}`,
                                });

                                const infoWindow = new google.maps.InfoWindow({
                                    content: `
                                        <div style="font-family: 'Inter', sans-serif; padding: 8px; max-width: 220px;">
                                            <div style="font-weight: 800; color: #5D3A29; font-size: 14px; margin-bottom: 4px;">
                                                Parada ${i + 1}: ${stop.clientName}
                                            </div>
                                            <div style="color: #888; font-size: 12px; margin-bottom: 4px;">${stop.address}</div>
                                            <div style="color: #5D3A29; font-size: 11px;">${stop.items}</div>
                                            <div style="color: #D4A373; font-size: 11px; margin-top: 4px; font-weight: 600;">
                                                ${leg.distance?.text || ''} · ${leg.duration?.text || ''}
                                            </div>
                                        </div>
                                    `,
                                });
                                marker.addListener('click', () => infoWindow.open(mapInstanceRef.current!, marker));
                                markersRef.current.push(marker);
                            }
                        });

                        // Destination marker (if different from last stop)
                        const lastLeg = route.legs[route.legs.length - 1];
                        if (lastLeg.end_location && endAddress) {
                            const destMarker = new google.maps.Marker({
                                position: lastLeg.end_location,
                                map: mapInstanceRef.current!,
                                label: { text: '🏁', fontSize: '20px' },
                                icon: {
                                    path: google.maps.SymbolPath.CIRCLE,
                                    fillColor: '#ef4444',
                                    fillOpacity: 1,
                                    strokeColor: '#ffffff',
                                    strokeWeight: 3,
                                    scale: 18,
                                },
                                title: 'Punto Final',
                            });
                            markersRef.current.push(destMarker);
                        }

                        setRouteInfo({
                            totalDistance: `${(totalDist / 1000).toFixed(1)} km`,
                            totalDuration: `${Math.ceil(totalDur / 60)} min`,
                        });
                    }
                } else {
                    alert('No se pudo calcular la ruta. Verificá las direcciones.');
                }
            }
        );
    }, [mapsLoaded, originAddress, endAddress]);

    // Optimize with AI
    const handleOptimize = async () => {
        if (stops.length < 2) {
            alert('Necesitás al menos 2 paradas para optimizar la ruta.');
            return;
        }
        if (!originAddress.trim()) {
            alert('Por favor ingresá la dirección de origen en la configuración (⚙️).');
            setShowConfigPanel(true);
            return;
        }

        setIsOptimizing(true);
        setOptimizeResult(null);

        try {
            const optimizeFn = httpsCallable(functions, 'optimizeDeliveryRoute');
            const response = await optimizeFn({
                origin: originAddress,
                destination: endAddress || originAddress,
                stops: stops.map(s => ({
                    orderId: s.orderId,
                    clientName: s.clientName,
                    address: s.address,
                })),
            });

            const data = response.data as any;

            if (data.optimizedOrder && Array.isArray(data.optimizedOrder)) {
                // Reorder stops based on AI suggestion
                const reordered: DeliveryStop[] = [];
                data.optimizedOrder.forEach((item: any, idx: number) => {
                    const match = stops.find(s => s.orderId === item.orderId);
                    if (match) {
                        reordered.push({ ...match, position: idx + 1 });
                    }
                });

                // Add any stops not returned by AI
                stops.forEach(s => {
                    if (!reordered.find(r => r.orderId === s.orderId)) {
                        reordered.push({ ...s, position: reordered.length + 1 });
                    }
                });

                setStops(reordered);
                setOptimizeResult(data.reasoning || 'Ruta optimizada exitosamente.');
                drawRoute(reordered);
            }
        } catch (error: any) {
            console.error('Error optimizing route:', error);
            setOptimizeResult('Error al optimizar. Intentá de nuevo.');
        } finally {
            setIsOptimizing(false);
        }
    };

    // Manual route calc (no AI, just draw in current order)
    const handleCalcRoute = () => {
        if (stops.length === 0) return;
        if (!originAddress.trim()) {
            alert('Ingresá la dirección de origen en la configuración (⚙️).');
            setShowConfigPanel(true);
            return;
        }
        drawRoute(stops);
    };

    // Open Google Maps navigation
    const handleNavigate = () => {
        if (stops.length === 0) return;

        const origin = encodeURIComponent(originAddress || stops[0].address);
        const dest = encodeURIComponent(endAddress || originAddress || stops[stops.length - 1].address);
        const waypoints = stops.map(s => encodeURIComponent(s.address)).join('|');

        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&waypoints=${waypoints}&travelmode=driving`;
        window.open(url, '_blank');
    };

    // Move stop up/down
    const moveStop = (index: number, direction: 'up' | 'down') => {
        const newStops = [...stops];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newStops.length) return;
        [newStops[index], newStops[targetIndex]] = [newStops[targetIndex], newStops[index]];
        newStops.forEach((s, i) => s.position = i + 1);
        setStops(newStops);
        setRouteInfo(null);
    };

    const handleMarkDelivered = async (orderId: string) => {
        if (!confirm('¿Seguro que querés marcar este pedido como entregado?')) return;
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'delivered' });
        } catch (error) {
            console.error('Error:', error);
            alert('No se pudo actualizar el estado.');
        }
    };

    const handleRevertDelivered = async (orderId: string) => {
        if (!confirm('¿Seguro que querés volver a marcar este pedido como pendiente?')) return;
        try {
            await updateDoc(doc(db, 'orders', orderId), { status: 'pending' });
        } catch (error) {
            console.error('Error:', error);
            alert('No se pudo actualizar el estado.');
        }
    };

    const formatDateForDisplay = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    const deliveryOrdersCount = orders.filter(o => {
        if (!selectedDate) return false;
        const [y, m, d] = selectedDate.split('-').map(Number);
        const od = new Date(o.deliveryDate);
        return od.getDate() === d && od.getMonth() === m - 1 && od.getFullYear() === y && o.status === 'pending';
    }).length;

    const noAddressCount = deliveryOrdersCount - stops.length;

    return (
        <div className="space-y-6 pb-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-serif font-black text-brand-brown tracking-tight flex items-center gap-3">
                        <span className="text-3xl bg-brand-brown/5 p-2.5 rounded-xl border border-brand-brown/10 shadow-sm leading-none">🚚</span>
                        Envíos del Día
                    </h1>
                    <p className="text-brand-brown/50 text-sm mt-1 ml-1">Organizá y optimizá tus entregas</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2.5 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white text-brand-brown font-medium shadow-sm"
                    />
                    <button
                        onClick={() => setShowConfigPanel(!showConfigPanel)}
                        className={`p-2.5 rounded-xl border transition-all shadow-sm ${showConfigPanel ? 'bg-brand-brown text-white border-brand-brown' : 'bg-white text-brand-brown border-brand-brown/20 hover:bg-brand-brown/5'}`}
                        title="Configurar direcciones"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Config Panel */}
            {showConfigPanel && (
                <div className="glass-card rounded-2xl p-6 animate-fade-in-up border border-brand-accent/20">
                    <h3 className="text-lg font-serif font-bold text-brand-brown mb-4 flex items-center gap-2">
                        <span>⚙️</span> Configuración del Recorrido
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <datalist id="savedAddresses">
                            {companyAddress && <option value={companyAddress}>Local Principal</option>}
                            <option value="Alternativa Keto">Alternativa Keto</option>
                        </datalist>
                        <div>
                            <label className="block text-xs font-bold text-brand-brown/60 mb-1.5 uppercase tracking-wider">
                                📍 Punto de Partida
                            </label>
                            <input
                                type="text"
                                list="savedAddresses"
                                value={originAddress}
                                onChange={(e) => saveOrigin(e.target.value)}
                                className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white text-brand-brown shadow-sm"
                                placeholder="Ej: Av. Corrientes 1234, CABA"
                            />
                            <button
                                onClick={() => saveOrigin('Alternativa Keto')}
                                className="mt-2 text-[11px] font-bold text-brand-brown bg-brand-brown/10 hover:bg-brand-brown/20 px-3 py-1.5 rounded-lg ml-1 transition-colors"
                            >
                                📍 Usar Alternativa Keto
                            </button>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-brown/60 mb-1.5 uppercase tracking-wider">
                                🏁 Punto Final
                            </label>
                            <input
                                type="text"
                                list="savedAddresses"
                                value={endAddress}
                                onChange={(e) => saveEnd(e.target.value)}
                                className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white text-brand-brown shadow-sm"
                                placeholder="Igual que el origen si dejás vacío"
                            />
                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    onClick={() => saveEnd('Alternativa Keto')}
                                    className="text-[11px] font-bold text-brand-brown bg-brand-brown/10 hover:bg-brand-brown/20 px-3 py-1.5 rounded-lg ml-1 transition-colors"
                                >
                                    🏁 Usar Alternativa Keto
                                </button>
                                <p className="text-[10px] text-brand-brown/40">Vacío = Partida</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats bar */}
            <div className="flex flex-wrap gap-3">
                <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    <div>
                        <span className="text-2xl font-bold text-brand-brown">{deliveryOrdersCount}</span>
                        <span className="text-xs text-brand-brown/50 ml-1">pedidos</span>
                    </div>
                </div>
                <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="text-lg">🚚</span>
                    <div>
                        <span className="text-2xl font-bold text-brand-brown">{stops.length}</span>
                        <span className="text-xs text-brand-brown/50 ml-1">con dirección</span>
                    </div>
                </div>
                {noAddressCount > 0 && (
                    <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2 border border-amber-200 bg-amber-50/50">
                        <span className="text-lg">⚠️</span>
                        <div>
                            <span className="text-2xl font-bold text-amber-700">{noAddressCount}</span>
                            <span className="text-xs text-amber-700/60 ml-1">sin dirección</span>
                        </div>
                    </div>
                )}
                {routeInfo && (
                    <>
                        <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2 border border-green-200 bg-green-50/50">
                            <span className="text-lg">📏</span>
                            <div>
                                <span className="text-2xl font-bold text-green-700">{routeInfo.totalDistance}</span>
                            </div>
                        </div>
                        <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-2 border border-blue-200 bg-blue-50/50">
                            <span className="text-lg">⏱️</span>
                            <div>
                                <span className="text-2xl font-bold text-blue-700">{routeInfo.totalDuration}</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Main content: Map + Stops List */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Map */}
                <div className="lg:col-span-3 glass-card rounded-2xl overflow-hidden relative min-h-[300px] lg:min-h-[450px]">
                    {mapsError === 'API_KEY_MISSING' ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-brand-beige to-white">
                            <div className="text-6xl mb-4">🗺️</div>
                            <h3 className="text-xl font-serif font-bold text-brand-brown mb-2">Configurá Google Maps</h3>
                            <p className="text-brand-brown/60 text-sm text-center max-w-md mb-4">
                                Para ver el mapa necesitás una API Key de Google Maps.
                                Abrí el archivo <code className="bg-brand-brown/10 px-2 py-0.5 rounded text-xs font-mono">.env.local</code> y reemplazá <code className="bg-brand-brown/10 px-2 py-0.5 rounded text-xs font-mono">TU_API_KEY_AQUI</code> con tu key.
                            </p>
                            <div className="bg-brand-brown/5 border border-brand-brown/10 rounded-xl p-4 text-xs font-mono text-brand-brown/80 w-full max-w-md">
                                VITE_GOOGLE_MAPS_API_KEY=AIzaSy...
                            </div>
                        </div>
                    ) : mapsError === 'MAPS_LOAD_FAILED' ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                            <div className="text-5xl mb-3">❌</div>
                            <h3 className="text-lg font-bold text-brand-brown">Error al cargar Google Maps</h3>
                            <p className="text-brand-brown/60 text-sm">Verificá tu API Key y que la API esté habilitada.</p>
                        </div>
                    ) : (
                        <div ref={mapRef} className="w-full h-full min-h-[300px] lg:min-h-[450px]" />
                    )}

                    {isLoadingRoute && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-10">
                            <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl shadow-lg border border-brand-brown/10">
                                <div className="w-5 h-5 rounded-full border-3 border-brand-accent/30 border-t-brand-accent animate-spin" style={{ borderWidth: '3px' }}></div>
                                <span className="text-brand-brown font-bold text-sm">Calculando ruta...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Stops List */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button
                            onClick={handleOptimize}
                            disabled={isOptimizing || stops.length < 2}
                            className="flex-1 warm-gradient-brown text-white font-bold py-3 px-4 rounded-xl shadow-lg hover:brightness-110 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2 text-sm"
                        >
                            {isOptimizing ? (
                                <>
                                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                                    Optimizando...
                                </>
                            ) : (
                                <>
                                    <span>🤖</span> Optimizar con IA
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleCalcRoute}
                            disabled={stops.length === 0 || isLoadingRoute}
                            className="flex-1 bg-white text-brand-brown font-bold py-3 px-4 rounded-xl border border-brand-brown/20 hover:bg-brand-brown/5 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-sm"
                        >
                            <span>🗺️</span> Ver Ruta
                        </button>
                        <button
                            onClick={handleNavigate}
                            disabled={stops.length === 0}
                            className="flex-1 bg-green-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-green-700 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-lg"
                        >
                            <span>🧭</span> Navegar
                        </button>
                    </div>

                    {/* AI Result */}
                    {optimizeResult && (
                        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-4 animate-fade-in">
                            <div className="flex items-start gap-2">
                                <span className="text-lg">🤖</span>
                                <div>
                                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Resultado IA</p>
                                    <p className="text-sm text-blue-900/80">{optimizeResult}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Orders Selection List */}
                    <div className="space-y-2 max-h-[60vh] lg:max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                        {dayOrdersStore.length === 0 ? (
                            <div className="glass-card rounded-2xl p-8 text-center">
                                <div className="text-5xl mb-3">📭</div>
                                <h3 className="text-lg font-serif font-bold text-brand-brown mb-1">Sin entregas</h3>
                                <p className="text-brand-brown/50 text-sm">
                                    No hay pedidos pendientes para el {formatDateForDisplay(selectedDate)}
                                </p>
                            </div>
                        ) : (
                            dayOrdersStore.map((order) => {
                                const isSelected = selectedOrderIds.includes(order.id);
                                const client = clients.find(c => c.id === order.clientId);
                                const originalAddr = (order as any).clientAddress || client?.address || '';
                                const currentAddr = editedAddresses[order.id] || originalAddr;
                                const isEditing = editingAddressId === order.id;

                                // Find its computed stop position if it's currently a valid stop
                                const stopObj = stops.find(s => s.orderId === order.id);
                                const position = stopObj?.position;

                                const phoneStr = (order as any).clientPhone || client?.phone || '';
                                const cleanPhone = phoneStr.replace(/[^0-9]/g, '');
                                const waMsg = encodeURIComponent(`¡Hola ${order.clientName}! Te escribimos de Alternativa Keto para avisarte que tu pedido ya está en camino y pronto estaremos llegando. 🚚✨`);

                                return (
                                    <div key={order.id} className={`glass-card rounded-xl p-4 transition-all group border ${isSelected ? 'border-brand-accent/40 shadow-md opacity-100' : 'border-transparent opacity-60 hover:opacity-100 hover:border-brand-brown/10'}`}>
                                        <div className="flex items-start gap-4">
                                            {/* Checkbox & Position Badge */}
                                            <div className="flex flex-col items-center gap-2 shrink-0 pt-1">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isSelected}
                                                    onChange={() => toggleOrderSelection(order.id)}
                                                    className="w-5 h-5 rounded cursor-pointer accent-brand-accent border-brand-brown/30"
                                                />
                                                {isSelected && position && currentAddr && (
                                                    <div className="warm-gradient-brown text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md">
                                                        {position}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Order details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-bold text-brand-brown text-sm truncate cursor-pointer select-none" onClick={() => toggleOrderSelection(order.id)} >
                                                        {order.clientName}
                                                    </h4>
                                                    <span className="text-xs font-bold text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                                                        ${order.total.toLocaleString()}
                                                    </span>
                                                </div>

                                                {/* Address handling */}
                                                {isEditing ? (
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={tempAddress}
                                                            onChange={(e) => setTempAddress(e.target.value)}
                                                            className="flex-1 px-3 py-1.5 text-xs border border-brand-accent/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-accent shadow-inner text-brand-brown"
                                                            placeholder="Nueva dirección..."
                                                            autoFocus
                                                        />
                                                        <button 
                                                            onClick={() => saveEditedAddress(order.id)} 
                                                            className="bg-brand-accent text-white px-3 py-1.5 text-xs rounded-lg font-bold shadow-sm hover:brightness-110"
                                                        >
                                                            Ok
                                                        </button>
                                                        <button 
                                                            onClick={() => setEditingAddressId(null)} 
                                                            className="text-brand-brown/50 hover:text-brand-brown hover:bg-brand-brown/10 p-1 rounded-lg"
                                                            title="Cancelar"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-start justify-between gap-2 mt-1 min-h-[22px]">
                                                        <p className="text-xs text-brand-brown/70 leading-snug flex-1">
                                                            <span className="mr-1">📍</span> 
                                                            {currentAddr ? currentAddr : <span className="italic text-red-500 font-medium select-none">Sin dirección - ¡Edítala!</span>}
                                                        </p>
                                                        <button 
                                                            onClick={() => { setEditingAddressId(order.id); setTempAddress(currentAddr); }}
                                                            className="text-xs text-brand-accent/80 hover:text-brand-accent font-medium underline shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity whitespace-nowrap p-1"
                                                        >
                                                            Editar
                                                        </button>
                                                    </div>
                                                )}

                                                <p className="text-xs text-brand-brown/40 truncate mt-1">
                                                    {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                                </p>
                                                
                                                {/* Action Bar */}
                                                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-brand-brown/10 opacity-100 lg:opacity-70 lg:group-hover:opacity-100 transition-opacity">
                                                    {phoneStr && (
                                                        <>
                                                            <a 
                                                                href={`tel:${phoneStr}`} 
                                                                className="flex items-center justify-center p-2 lg:p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors shadow-sm"
                                                                title="Llamar al cliente"
                                                            >
                                                                <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                                            </a>
                                                            {cleanPhone && (
                                                                <a 
                                                                    href={`https://wa.me/${cleanPhone.startsWith('549') ? cleanPhone : '549' + cleanPhone}?text=${waMsg}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center justify-center p-2 lg:p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors shadow-sm"
                                                                    title="Avisar por WhatsApp"
                                                                >
                                                                    <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="currentColor" viewBox="0 0 24 24">
                                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                                                    </svg>
                                                                </a>
                                                            )}
                                                        </>
                                                    )}
                                                    {currentAddr && (
                                                        <a
                                                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(currentAddr)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center justify-center p-2 lg:p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors shadow-sm"
                                                            title="Iniciar navegación directa"
                                                        >
                                                            <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                                        </a>
                                                    )}
                                                    <div className="flex-1"></div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleOrderSelection(order.id); }}
                                                        className="flex items-center justify-center p-2 lg:p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors shadow-sm"
                                                        title="Quitar cliente del recorrido"
                                                    >
                                                        <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleMarkDelivered(order.id); }}
                                                        className="flex items-center justify-center p-2 lg:p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors shadow-sm"
                                                        title="Marcar pedido como entregado ✅"
                                                    >
                                                        <svg className="w-5 h-5 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Reorder buttons (only if selected and valid stop) */}
                                            {isSelected && stopObj && (
                                                <div className="flex flex-col gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0 border-l border-brand-brown/10 pl-2 ml-1">
                                                    <button
                                                        onClick={() => moveStop(stopObj.position - 1, 'up')}
                                                        disabled={stopObj.position === 1}
                                                        className="p-2 lg:p-1 text-brand-brown/40 hover:text-brand-brown hover:bg-brand-brown/10 rounded disabled:opacity-30 transition-colors"
                                                        title="Subir"
                                                    >
                                                        <svg className="w-6 h-6 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => moveStop(stopObj.position - 1, 'down')}
                                                        disabled={stopObj.position === stops.length}
                                                        className="p-2 lg:p-1 text-brand-brown/40 hover:text-brand-brown hover:bg-brand-brown/10 rounded disabled:opacity-30 transition-colors"
                                                        title="Bajar"
                                                    >
                                                        <svg className="w-6 h-6 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        
                        {/* Pedidos Entregados section */}
                        {deliveredOrdersStore.length > 0 && (
                            <div className="mt-8 border-t border-brand-brown/10 pt-6 animate-fade-in">
                                <h3 className="text-lg font-serif font-bold text-stone-400 mb-4 flex items-center gap-2 select-none">
                                    <span>📦</span> Pedidos Entregados ({deliveredOrdersStore.length})
                                </h3>
                                <div className="space-y-3">
                                    {deliveredOrdersStore.map(order => (
                                        <div key={order.id} className="glass-card rounded-xl p-4 bg-stone-50/50 opacity-60 hover:opacity-100 transition-opacity flex flex-col sm:flex-row justify-between sm:items-center items-start gap-4 group">
                                            <div>
                                                <h4 className="font-bold text-stone-500 line-through decoration-stone-300 flex items-center gap-2">
                                                    {order.clientName}
                                                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded no-underline">ENTREGADO</span>
                                                </h4>
                                                <p className="text-xs text-stone-400 mt-1">
                                                    {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleRevertDelivered(order.id)}
                                                className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 px-3 py-2 text-[10px] uppercase font-bold text-brand-accent bg-brand-accent/10 hover:bg-brand-accent/20 rounded-lg transition-all whitespace-nowrap"
                                                title="Volver a poner pendiente"
                                            >
                                                Deshacer ↺
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeliveryRouteView;

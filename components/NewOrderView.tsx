import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Client, OrderItem, Order, Recipe } from '../types';
import jsPDF from 'jspdf';

interface NewOrderViewProps {
    userId: string;
    onBack: () => void;
    initialOrder?: Order | null;
    readOnly?: boolean;
    initialDate?: Date;
}

// Extended OrderItem for local state to include recipe tracking
interface LocalOrderItem extends OrderItem {
    recipeId?: string;
    suggestedPrice?: number;
}

const NewOrderView: React.FC<NewOrderViewProps> = ({ userId, onBack, initialOrder, readOnly, initialDate }) => {
    // Data State
    const [clients, setClients] = useState<Client[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');

    // Quick Client Add State
    const [showClientModal, setShowClientModal] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [newClientAddress, setNewClientAddress] = useState('');
    const [isCreatingClient, setIsCreatingClient] = useState(false);

    // Order State
    const [items, setItems] = useState<LocalOrderItem[]>([
        { id: '1', name: '', amount: 0, unit: 'un', quantity: 1, price: 0, suggestedPrice: 0 }
    ]);
    const [deliveryDate, setDeliveryDate] = useState('');
    const [deliveryTime, setDeliveryTime] = useState('');
    const [deposit, setDeposit] = useState<number>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Clients & Recipes
    useEffect(() => {
        if (!userId) return;

        // Clients
        const qClients = query(collection(db, 'clients'), where('userId', '==', userId));
        const unsubClients = onSnapshot(qClients, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            data.sort((a, b) => a.name.localeCompare(b.name));
            setClients(data);
        });

        // Recipes (Products)
        const qRecipes = query(collection(db, 'recipes'), where('userId', '==', userId));
        const unsubRecipes = onSnapshot(qRecipes, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
            data.sort((a, b) => a.name.localeCompare(b.name));
            setRecipes(data);
        });

        return () => {
            unsubClients();
            unsubRecipes();
        };
    }, [userId]);

    // Pre-fill for Edit Mode or Initial Date
    useEffect(() => {
        if (initialOrder) {
            setSelectedClientId(initialOrder.clientId);

            // Map items back to LocalOrderItem
            setItems(initialOrder.items.map((i: any, index: number) => {
                // If the order came from the catalog, its `recipeId` might be populated now, 
                // or if it's an old order, it might have saved the recipe ID in `i.id`.
                const inferredRecipeId = i.recipeId || (i.id && i.id.length > 15 ? i.id : '');
                const recipe = inferredRecipeId ? recipes.find((r: Recipe) => r.id === inferredRecipeId) : null;
                const calcPrice = (recipe && i.amount) ? Math.ceil(i.amount * recipe.costPerGram * 3) : 0;

                return {
                    ...i,
                    id: String(Date.now() + index), // unique UI key
                    amount: i.amount || 0,
                    unit: i.unit || 'un',
                    quantity: i.quantity || 1,
                    price: i.price || 0,
                    recipeId: inferredRecipeId,
                    suggestedPrice: calcPrice
                };
            }));

            // Date format YYYY-MM-DD
            if (initialOrder.deliveryDate) {
                const d = new Date(initialOrder.deliveryDate);
                const isoDate = d.toISOString().split('T')[0];
                setDeliveryDate(isoDate);
            }

            // Pre-fill delivery time
            if (initialOrder.deliveryTime) {
                setDeliveryTime(initialOrder.deliveryTime);
            }

            setDeposit(initialOrder.deposit || 0);
        } else if (initialDate) {
            const isoDate = initialDate.toISOString().split('T')[0];
            setDeliveryDate(isoDate);
        }
    }, [initialOrder, initialDate]);

    // Calculations
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const pendingBalance = total - deposit;

    // Handlers
    const handleAddItem = () => {
        setItems([
            ...items,
            { id: Date.now().toString(), name: '', amount: 0, unit: 'un', quantity: 1, price: 0, suggestedPrice: 0 }
        ]);
    };

    const handleItemChange = (id: string, field: keyof LocalOrderItem, value: any) => {
        setItems(prevItems => prevItems.map(item => {
            if (item.id !== id) return item;

            const updatedItem = { ...item, [field]: value };

            if (field === 'recipeId' || field === 'amount' || field === 'quantity') {
                const rId = updatedItem.recipeId;
                if (rId) {
                    const recipe = recipes.find(r => r.id === rId);
                    if (recipe) {
                        updatedItem.cost = recipe.isPromo ? (recipe.totalCost * updatedItem.quantity) : (updatedItem.amount * recipe.costPerGram * updatedItem.quantity);
                    }
                }
            }

            // Logic: Select Recipe -> Set Name, Keep ID, Recalc Price if Amount exists
            if (field === 'recipeId') {
                const recipe = recipes.find(r => r.id === value);
                if (recipe) {
                    updatedItem.name = recipe.name;
                    updatedItem.recipeId = recipe.id; // Store ID
                    // Recalc price if amount is set
                    if (updatedItem.amount > 0) {
                        // Price = Weight * CostPerGram * 3
                        const calcPrice = Math.ceil(updatedItem.amount * recipe.costPerGram * 3);
                        updatedItem.price = calcPrice;
                        updatedItem.suggestedPrice = calcPrice;
                    }
                }
            }

            // Logic: Change Amount -> Recalc Price if Recipe exists
            if (field === 'amount') {
                if (updatedItem.recipeId) {
                    const recipe = recipes.find(r => r.id === updatedItem.recipeId);
                    if (recipe) {
                        const calcPrice = Math.ceil(Number(value) * recipe.costPerGram * 3);
                        updatedItem.price = calcPrice;
                        updatedItem.suggestedPrice = calcPrice;
                    }
                }
            }

            return updatedItem;
        }));
    };

    const handleRemoveItem = (id: string) => {
        if (items.length === 1) return;
        setItems(items.filter(item => item.id !== id));
    };

    // Quick Client Creation
    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientName.trim()) return;

        setIsCreatingClient(true);
        try {
            const docRef = await addDoc(collection(db, 'clients'), {
                userId,
                name: newClientName,
                phone: newClientPhone,
                address: newClientAddress,
                createdAt: new Date()
            });
            setShowClientModal(false);
            setNewClientName(''); setNewClientPhone(''); setNewClientAddress('');
            setSelectedClientId(docRef.id);
            alert("Cliente creado y seleccionado!");
        } catch (error) {
            console.error(error);
            alert("Error al crear cliente");
        } finally {
            setIsCreatingClient(false);
        }
    };

    const handleDeleteOrder = async () => {
        if (!initialOrder || !window.confirm("¿Estás seguro de que quieres eliminar este pedido permanentemente?")) return;

        try {
            await deleteDoc(doc(db, 'orders', initialOrder.id));
            alert("Pedido eliminado correctamente");
            onBack();
        } catch (error) {
            console.error("Error deleting order:", error);
            alert("Error al eliminar el pedido");
        }
    };

    const generateOrderTicket = async () => {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: [80, 200 + (items.length * 10)] // Dynamic height based on items
            });

            const drawContent = (withLogo: boolean) => {
                try {
                    // Header
                    // Adjust header Y if logo is present - Give more space
                    const headerY = withLogo ? 65 : 20;

                    // Shop Name
                    doc.setFontSize(16);
                    doc.setFont("helvetica", "bold");
                    doc.text("Alternativa Keto", 40, headerY, { align: "center" });

                    // Divider
                    doc.setLineWidth(0.5);
                    doc.setDrawColor(0);
                    doc.line(5, headerY + 4, 75, headerY + 4);

                    // Client Info
                    const client = clients.find(c => c.id === selectedClientId);
                    const clientName = client?.name || "Cliente Final";
                    const clientPhone = client?.phone || "";
                    const clientAddress = client?.address || "";
                    const dateStr = deliveryDate ? deliveryDate.split('-').reverse().join('/') : new Date().toLocaleDateString();

                    let clientY = headerY + 12;

                    // Client Name - Larger
                    doc.setFontSize(20); // Reduced from 22
                    doc.setFont("helvetica", "bold");
                    doc.text(`Cliente: ${clientName}`, 5, clientY);
                    clientY += 10; // Increased spacing

                    // Extra Details - Phone/Address
                    doc.setFontSize(16); // Increased from 12
                    doc.setFont("helvetica", "normal");

                    if (clientPhone) {
                        doc.text(`Tel: ${clientPhone}`, 5, clientY);
                        clientY += 8; // Increased spacing
                    }
                    if (clientAddress) {
                        // Handle long addresses
                        const splitAddress = doc.splitTextToSize(`Dir: ${clientAddress}`, 70);
                        doc.text(splitAddress, 5, clientY);
                        clientY += (splitAddress.length * 8); // Increased line height
                    }

                    // Delivery Date & Time
                    const timeStr = deliveryTime ? ` a las ${deliveryTime}hs` : '';
                    doc.text(`Fecha Entrega: ${dateStr}${timeStr}`, 5, clientY);
                    clientY += 8; // Increased spacing

                    doc.setLineWidth(0.5);
                    doc.line(5, clientY + 2, 75, clientY + 2);

                    // Items Header
                    let currentY = clientY + 8; // Adapted spacing
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10); // Reset for header
                    doc.text("Cant.", 5, currentY);
                    doc.text("Producto", 20, currentY);
                    doc.text("Total", 75, currentY, { align: "right" });

                    currentY += 2; // Spacing after header text
                    doc.setLineWidth(0.2);
                    doc.line(5, currentY, 75, currentY); // Underline header
                    currentY += 5; // Start items

                    doc.setFont("helvetica", "normal");

                    // Items List
                    items.forEach(item => {
                        const itemName = item.name || "Producto";
                        // Wrap text if too long (max width approx 45mm)
                        const splitTitle = doc.splitTextToSize(itemName, 45);

                        doc.text(`${item.quantity}`, 5, currentY);
                        doc.text(splitTitle, 20, currentY);
                        doc.text(`$${item.price.toLocaleString()}`, 75, currentY, { align: "right" });

                        // Increase Y based on number of lines
                        currentY += (splitTitle.length * 5) + 3; // +3 for extra breathing room between items
                    });

                    // Totals Section
                    currentY += 2;
                    doc.setLineWidth(0.5);
                    doc.line(5, currentY, 75, currentY);
                    currentY += 6;

                    // Helper for right-aligned totals
                    const drawTotalRow = (label: string, value: string, isBold: boolean = false, fontSize: number = 0) => {
                        doc.setFont("helvetica", isBold ? "bold" : "normal");
                        doc.setFontSize(fontSize > 0 ? fontSize : (isBold ? 12 : 11));
                        doc.text(label, 45, currentY, { align: "right" });
                        doc.text(value, 75, currentY, { align: "right" });
                        currentY += (fontSize > 12 ? 10 : 6); // More space for larger fonts
                    };

                    drawTotalRow("Total:", `$${total.toLocaleString()}`, true);

                    if (deposit > 0) {
                        drawTotalRow("Seña:", `-$${deposit.toLocaleString()}`, false);

                        // Small separator for final balance
                        doc.setLineWidth(0.2);
                        doc.line(40, currentY - 4, 75, currentY - 4);
                        currentY += 2;

                        // Resta - Larger
                        drawTotalRow("Resta:", `$${pendingBalance.toLocaleString()}`, true, 22);
                    } else {
                        currentY += 2;
                    }

                    // Footer
                    currentY += 5;
                    doc.setFontSize(10);
                    doc.setFont("helvetica", "italic");
                    doc.text("¡Gracias por su compra!", 40, currentY, { align: "center" });

                    // Instagram Block
                    const iconY = currentY + 5;
                    const iconSize = 7;
                    const startX = 18;

                    // Icon Drawing
                    doc.setDrawColor(0);
                    doc.setLineWidth(0.3);
                    doc.roundedRect(startX, iconY, iconSize, iconSize, 1.5, 1.5, 'S');
                    doc.circle(startX + (iconSize / 2), iconY + (iconSize / 2), iconSize * 0.25, 'S');
                    doc.circle(startX + (iconSize * 0.75), iconY + (iconSize * 0.22), 0.3, 'F');

                    // Handle Text
                    doc.setFont("helvetica", "bold");
                    doc.setFontSize(10);
                    doc.text("@alternativaketo", startX + iconSize + 2, iconY + 5);
                    
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.text("www.alternativaketo.com", 40, iconY + 12, { align: "center" });

                    // Output: Open in New Tab
                    const pdfBlob = doc.output('blob');
                    const blobUrl = URL.createObjectURL(pdfBlob);
                    const newWindow = window.open(blobUrl, '_blank');

                    if (!newWindow) {
                        const clientSafe = clientName.replace(/[^a-zA-Z0-9]/g, '_');
                        doc.save(`ticket_${clientSafe}.pdf`);
                        alert("Ventana emergente bloqueada. Se descargó el archivo.");
                    }
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

                } catch (innerErr: any) {
                    console.error("Error drawing ticket:", innerErr);
                    alert(`Error al generar contenido del ticket: ${innerErr.message}`);
                }
            };

            const img = new Image();
            // Use import.meta.env.BASE_URL for correct path resolution
            const logoPath = `${import.meta.env.BASE_URL}logo.png`;
            img.src = logoPath;

            img.onload = () => {
                // Add Logo - Smaller and Centered
                // Page width 80. Center is 40.
                // Size 45x45. X = 40 - (45/2) = 17.5
                doc.addImage(img, 'PNG', 17.5, 5, 45, 45, undefined, 'FAST');
                drawContent(true);
            };

            img.onerror = () => {
                console.warn("Logo load failed");
                drawContent(false);
            };

        } catch (err: any) {
            console.error("PDF Init Error:", err);
            alert(`Error al iniciar PDF: ${err.message}`);
        }
    };

    // Submit Order
    const handleSubmit = async (ticket: boolean) => {
        if (!selectedClientId) {
            alert("Por favor selecciona un cliente");
            return;
        }
        if (items.some(i => !i.name || i.price <= 0)) {
            alert("Por favor completa los detalles del producto (y asegúrate que el precio > 0)");
            return;
        }

        setIsSubmitting(true);
        try {
            const client = clients.find(c => c.id === selectedClientId);

            // Map back to standard OrderItem (remove recipeId if strictly following interface, or keep it)
            // Interface OrderItem doesn't have recipeId, so we clean it up or rely on structural typing ignoring extra props?
            // Firestore saves extra props. Let's keep it, it's useful.

            // Parse date manually to ensure Local Time (prevent timezone shifts)
            let dateObj = new Date();
            if (deliveryDate) {
                const [y, m, d] = deliveryDate.split('-').map(Number);
                dateObj = new Date(y, m - 1, d); // Local midnight
            }

            // Determine status: if date is in the past, it's completed
            const normalizedToday = new Date();
            normalizedToday.setHours(0, 0, 0, 0);
            const isPastDate = dateObj < normalizedToday;

            // Ensure cost is snapshotted for all items, even old ones
            const itemsWithCost = items.map(item => {
                if (item.cost !== undefined) return item;
                
                // Fallback snapshot logic for items that didn't have cost set yet
                let fallbackCost = item.price / 3;
                if (item.recipeId) {
                    const recipe = recipes.find(r => r.id === item.recipeId);
                    if (recipe) {
                        fallbackCost = recipe.isPromo ? recipe.totalCost * item.quantity : item.amount * recipe.costPerGram * item.quantity;
                    }
                }
                return { ...item, cost: fallbackCost };
            });

            const orderData: Omit<Order, 'id'> = {
                userId,
                clientId: selectedClientId,
                clientName: client?.name || 'Cliente Desconocido',
                items: itemsWithCost,
                deliveryDate: dateObj,
                deliveryTime: deliveryTime || '',
                status: isPastDate ? 'completed' : 'pending',
                total,
                deposit,
                createdAt: new Date()
            };

            const docRef = initialOrder
                ? await updateDoc(doc(db, 'orders', initialOrder.id), orderData)
                : await addDoc(collection(db, 'orders'), orderData);

            if (ticket) {
                alert(`Pedido guardado! Ticket sería generado para ID: ${initialOrder ? initialOrder.id : (docRef as any).id}`);
            } else {
                alert(initialOrder ? "Pedido actualizado correctamente!" : "Pedido confirmado correctamente!");
                onBack();
            }

        } catch (error) {
            console.error("Error creating order:", error);
            alert("Error al crear el pedido");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200 relative">

            {/* Quick Add Client Modal */}
            {showClientModal && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in duration-200">
                        <h3 className="text-xl font-bold text-brand-brown mb-4 font-serif">Nuevo Cliente Rápido</h3>
                        <form onSubmit={handleCreateClient} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-brand-brown mb-1">Nombre</label>
                                <input autoFocus type="text" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} className="w-full p-2.5 rounded-lg border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none" required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-brown mb-1">Teléfono</label>
                                <input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} className="w-full p-2.5 rounded-lg border border-brand-brown/20" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-brown mb-1">Dirección</label>
                                <input type="text" value={newClientAddress} onChange={(e) => setNewClientAddress(e.target.value)} className="w-full p-2.5 rounded-lg border border-brand-brown/20" />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setShowClientModal(false)} className="flex-1 py-2 rounded-lg border border-brand-brown/20 text-brand-brown font-bold hover:bg-brand-brown/5">Cancelar</button>
                                <button type="submit" disabled={isCreatingClient} className="flex-1 py-2 rounded-lg bg-brand-brown text-white font-bold hover:bg-[#5D4229]">Guardar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center p-5 sm:p-6 border-b border-brand-brown/10 relative bg-white/80 backdrop-blur-xl sticky top-0 z-20">
                <div className="w-full text-center">
                    <h2 className="text-xl sm:text-2xl font-serif font-black text-brand-brown tracking-tight flex items-center justify-center gap-3">
                        <span className="text-2xl bg-brand-brown/5 p-2 rounded-xl border border-brand-brown/10 shadow-sm leading-none">
                            {initialOrder ? (readOnly ? '📄' : '📝') : '🛍️'}
                        </span>
                        {initialOrder ? (readOnly ? 'Detalles del Pedido' : 'Editar Pedido') : 'Nuevo Pedido'}
                    </h2>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 sm:space-y-10 bg-brand-cream/10 custom-scrollbar">

                {/* 1. Select Client */}
                <div className="space-y-4">
                    {/* Catalog Banner */}
                    {(initialOrder as any)?.source === 'catalog' && (
                        <div className="bg-green-50/80 border border-green-200 p-5 rounded-2xl mb-4 animate-fade-in shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-green-200/40 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                            <h4 className="font-bold text-green-800 mb-3 flex items-center gap-2 text-lg">
                                <span>🛒</span> Recibido desde el Catálogo
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm text-green-900/80 bg-white/70 p-4 rounded-xl border border-green-100 shadow-sm">
                                <div><strong className="text-green-900 block text-xs uppercase opacity-80 mb-0.5">Nombre</strong> {initialOrder!.clientName}</div>
                                <div><strong className="text-green-900 block text-xs uppercase opacity-80 mb-0.5">Teléfono</strong> {(initialOrder as any).clientPhone || '-'}</div>
                                <div><strong className="text-green-900 block text-xs uppercase opacity-80 mb-0.5">Entrega</strong> {(initialOrder as any).deliveryMethod === 'delivery' ? '🛵 Envío a Domicilio' : '🏪 Retiro en Local'}</div>
                                {(initialOrder as any).deliveryMethod === 'delivery' && (
                                    <div><strong className="text-green-900 block text-xs uppercase opacity-80 mb-0.5">Dirección</strong> {(initialOrder as any).clientAddress || '-'}</div>
                                )}
                                {(initialOrder as any).clientNotes && (
                                    <div className="md:col-span-2 mt-1 p-3 bg-green-50 rounded-lg border border-green-100/50"><strong className="text-green-900 block text-xs uppercase opacity-80 mb-0.5">Preferencias</strong> {(initialOrder as any).clientNotes}</div>
                                )}
                            </div>
                            {!selectedClientId && (
                                <div className="flex flex-col md:flex-row gap-3 items-center mt-4 border-t border-green-200/50 pt-4">
                                    <button
                                        onClick={() => {
                                            setNewClientName(initialOrder!.clientName);
                                            setNewClientPhone((initialOrder as any).clientPhone || '');
                                            setNewClientAddress((initialOrder as any).clientAddress || '');
                                            setShowClientModal(true);
                                        }}
                                        className="w-full md:w-auto px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-md flex items-center justify-center gap-2"
                                    >
                                        <span>👤</span> Crear Cliente desde Pedido
                                    </button>
                                    <span className="text-sm text-green-900/60 font-medium">o vinculá a un cliente existente 👇</span>
                                </div>
                            )}
                        </div>
                    )}

                    <h3 className="text-sm font-bold text-brand-brown flex items-center gap-2 uppercase tracking-widest opacity-90 border-b border-brand-brown/10 pb-2">
                        <span className="bg-brand-brown/10 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span> 
                        <span>Seleccionar Cliente</span>
                    </h3>
                    <div className="flex gap-3">
                        <div className="relative flex-1 group">
                            <select
                                value={selectedClientId}
                                onChange={(e) => setSelectedClientId(e.target.value)}
                                disabled={readOnly}
                                className={`w-full p-4 pr-10 rounded-xl border bg-white shadow-sm outline-none text-brand-brown appearance-none disabled:opacity-70 disabled:bg-stone-50 transition-shadow focus:ring-2 focus:ring-brand-accent/50 group-hover:shadow-md ${!selectedClientId && (initialOrder as any)?.source === 'catalog' ? 'border-red-400 ring-2 ring-red-100' : 'border-brand-brown/20'}`}
                            >
                                <option value="">Buscar Cliente Existente...</option>
                                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-brand-brown/40 group-hover:text-brand-brown/70 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15 12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" /></svg>
                            </div>
                        </div>
                        {!readOnly && (
                            <button onClick={() => {
                                setNewClientName('');
                                setNewClientPhone('');
                                setNewClientAddress('');
                                setShowClientModal(true);
                            }} className="bg-brand-brown text-white px-5 py-4 rounded-xl hover:bg-[#5D4229] shadow-[0_4px_15px_rgba(93,66,41,0.2)] transition-colors flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            </button>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brand-brown flex items-center gap-2 uppercase tracking-widest opacity-90 border-b border-brand-brown/10 pb-2">
                        <span className="bg-brand-brown/10 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span> 
                        <span>Agregar Productos</span>
                    </h3>

                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={item.id} className="bg-white p-5 rounded-2xl border border-brand-brown/10 relative shadow-[0_2px_15px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_25px_rgb(0,0,0,0.06)] transition-all">
                                {items.length > 1 && !readOnly && (
                                    <button onClick={() => handleRemoveItem(item.id)} className="absolute -top-2 -right-2 bg-red-100 text-red-500 rounded-full p-1 shadow-sm hover:bg-red-200">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                )}

                                <div className="grid grid-cols-12 gap-3">
                                    <div className="col-span-12 sm:col-span-5">
                                        <label className="block text-xs font-bold text-brand-brown/60 mb-1.5 uppercase tracking-wider">Producto</label>
                                        <select
                                            value={item.recipeId || ''}
                                            onChange={(e) => handleItemChange(item.id, 'recipeId', e.target.value)}
                                            disabled={readOnly}
                                            className="w-full p-3 rounded-xl border border-brand-brown/20 bg-brand-cream/30 hover:bg-white text-sm disabled:opacity-70 disabled:bg-stone-50 transition-colors focus:ring-2 focus:ring-brand-accent/50 outline-none cursor-pointer"
                                        >
                                            <option value="">Seleccionar Receta...</option>
                                            {recipes.map(recipe => (
                                                <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-span-4 sm:col-span-3">
                                        <label className="block text-xs font-bold text-brand-brown/60 mb-1.5 uppercase tracking-wider">Peso(g)/Un</label>
                                        <input
                                            type="number"
                                            value={item.amount || ''}
                                            onChange={(e) => handleItemChange(item.id, 'amount', parseFloat(e.target.value))}
                                            placeholder="200"
                                            disabled={readOnly}
                                            className="w-full p-3 rounded-xl border border-brand-brown/20 bg-brand-cream/30 hover:bg-white disabled:opacity-70 disabled:bg-stone-50 transition-colors focus:ring-2 focus:ring-brand-accent/50 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-3 sm:col-span-2">
                                        <label className="block text-xs font-bold text-brand-brown/60 mb-1.5 uppercase tracking-wider">Cant.</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)}
                                            disabled={readOnly}
                                            className="w-full p-3 rounded-xl border border-brand-brown/20 bg-brand-cream/30 hover:bg-white disabled:opacity-70 disabled:bg-stone-50 transition-colors focus:ring-2 focus:ring-brand-accent/50 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-5 sm:col-span-2">
                                        <label className="block text-xs font-bold text-brand-brown/60 mb-1.5 uppercase tracking-wider">Total</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={item.price || ''}
                                                onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                                                disabled={readOnly}
                                                className="w-full p-3 rounded-xl border border-brand-brown/20 bg-brand-accent/10 font-black text-brand-brown focus:ring-2 focus:ring-brand-accent/50 outline-none"
                                            />
                                            {!!item.suggestedPrice && item.suggestedPrice > 0 && (
                                                <div className="mt-1 text-[10px] text-brand-brown/60 font-medium px-1">
                                                    Sugerido: ${item.suggestedPrice.toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {!readOnly && (
                        <button onClick={handleAddItem} className="w-full py-4 border-2 border-dashed border-brand-brown/30 bg-white/50 rounded-2xl text-brand-brown font-bold hover:bg-brand-brown/5 hover:border-brand-brown/50 hover:shadow-sm transition-all flex items-center justify-center gap-2">
                            <span>+</span> Añadir otro producto
                        </button>
                    )}
                </div>

                {/* 3. Delivery Details */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brand-brown flex items-center gap-2 uppercase tracking-widest opacity-90 border-b border-brand-brown/10 pb-2">
                        <span className="bg-brand-brown/10 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span> 
                        <span>Detalles de Entrega</span>
                    </h3>

                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-brown/10 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-bold text-brand-brown/60 mb-1.5 uppercase tracking-wider">Fecha de Entrega</label>
                            <input
                                type="date"
                                value={deliveryDate}
                                onChange={(e) => setDeliveryDate(e.target.value)}
                                disabled={readOnly}
                                className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-brand-cream/30 hover:bg-white text-brand-brown font-medium disabled:opacity-70 disabled:bg-stone-50 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-brand-brown/60 mb-1.5 uppercase tracking-wider">Hora de Entrega</label>
                            <input
                                type="time"
                                value={deliveryTime}
                                onChange={(e) => setDeliveryTime(e.target.value)}
                                disabled={readOnly}
                                className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-brand-cream/30 hover:bg-white text-brand-brown font-medium disabled:opacity-70 disabled:bg-stone-50 transition-colors"
                                placeholder="14:00"
                            />
                        </div>

                        <div className="md:col-span-2 pt-2 border-t border-brand-brown/5">
                            <label className="block text-xs font-bold text-brand-brown/60 mb-1.5 uppercase tracking-wider">Seña / Adelanto ($)</label>
                            <input
                                type="number"
                                value={deposit || ''}
                                onChange={(e) => setDeposit(parseFloat(e.target.value) || 0)}
                                disabled={readOnly}
                                className="w-full max-w-xs p-3.5 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white shadow-inner text-xl text-brand-brown font-bold disabled:opacity-70 disabled:bg-stone-50 transition-colors"
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {/* 4. Payment */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brand-brown flex items-center gap-2 uppercase tracking-widest opacity-90 border-b border-brand-brown/10 pb-2">
                        <span className="bg-brand-brown/10 w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span> 
                        <span>Resumen de Pago</span>
                    </h3>


                    <div className="bg-gradient-to-br from-brand-brown to-[#4A2E21] p-5 sm:p-6 rounded-2xl text-white shadow-xl relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                        <div className="flex justify-between items-center text-sm md:text-base mb-3 opacity-90 relative">
                            <span>Total de la Orden:</span>
                            <span className="font-bold text-xl">${total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-white relative pt-4 border-t border-white/20">
                            <span className="text-sm md:text-base font-bold uppercase tracking-wider">Saldo Pendiente:</span>
                            <span className="font-black text-2xl sm:text-3xl tracking-tight text-brand-accent drop-shadow-sm">${pendingBalance.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-brand-brown/10 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row gap-3 z-20">
                {initialOrder && !readOnly && (
                    <button
                        onClick={handleDeleteOrder}
                        type="button"
                        className="p-4 rounded-xl border-2 border-red-100 bg-white text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors shadow-sm"
                        title="Eliminar Pedido"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                )}
                {!readOnly && (
                    <button onClick={() => handleSubmit(false)} disabled={isSubmitting} className="flex-1 bg-brand-brown text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:bg-black hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-brand-brown">
                        {isSubmitting ? 'Guardando...' : (initialOrder ? 'Actualizar Orden' : 'Confirmar Orden')}
                    </button>
                )}
                <button onClick={generateOrderTicket} className="flex-1 warm-gradient-brown text-white font-bold text-lg py-4 rounded-xl shadow-lg hover:brightness-110 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Ticket Imprimible
                </button>
            </div>
        </div>
    );
};

export default NewOrderView;

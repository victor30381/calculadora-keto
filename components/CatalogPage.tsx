import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, doc, getDoc } from 'firebase/firestore';
import { Recipe } from '../types';

interface CatalogPageProps {
    userId: string;
}

interface CartItem {
    recipe: Recipe;
    quantity: number;
}

const ImageCarousel: React.FC<{ images: string[], alt: string }> = ({ images, alt }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!images || images.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
        }, 3000); // Cambia la foto cada 3 segundos
        return () => clearInterval(interval);
    }, [images]);

    if (!images || images.length === 0) {
        return (
            <div className="w-full h-48 warm-gradient-brown flex items-center justify-center">
                <span className="text-5xl opacity-80">🍰</span>
            </div>
        );
    }

    if (images.length === 1) {
        return (
            <div className="w-full aspect-[4/3] overflow-hidden bg-brand-cream/50">
                <img src={images[0]} alt={alt} className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" />
            </div>
        );
    }

    return (
        <div className="relative w-full aspect-[4/3] overflow-hidden group bg-brand-cream/50">
            {images.map((imgSrc, idx) => (
                <img 
                    key={idx}
                    src={imgSrc} 
                    alt={`${alt} - ${idx + 1}`} 
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out group-hover:scale-105 ${idx === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'}`} 
                />
            ))}
            
            {/* Arrows */}
            <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }}
                    className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors shadow-sm"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
                <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }}
                    className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/50 transition-colors shadow-sm"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
            </div>

            {/* Dots */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                {images.map((_, idx) => (
                    <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors shadow-sm ${idx === currentIndex ? 'bg-white scale-125' : 'bg-white/50'}`} />
                ))}
            </div>
        </div>
    );
};

const ProductCard: React.FC<{
    recipe: Recipe;
    inCart?: CartItem;
    onAddToCart: (recipe: Recipe) => void;
    onUpdateQuantity: (recipeId: string, qty: number) => void;
}> = ({ recipe, inCart, onAddToCart, onUpdateQuantity }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div className="relative group w-full h-full perspective-[1000px] card-hover-lift">
            <div 
                className={`w-full h-full relative transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
                {/* FRONT */}
                <div 
                    onClick={() => { if (recipe.catalogDescription?.trim()) setIsFlipped(true); }}
                    className={`glass-card rounded-2xl overflow-hidden flex flex-col h-full w-full [backface-visibility:hidden] ${recipe.catalogDescription?.trim() ? 'cursor-pointer' : ''}`}
                >
                    <ImageCarousel 
                        images={recipe.catalogImages && recipe.catalogImages.length > 0 ? recipe.catalogImages : (recipe.catalogImage ? [recipe.catalogImage] : [])} 
                        alt={recipe.name} 
                    />
                    <div className="p-5 flex flex-col flex-1">
                        <h3 className="font-serif font-bold text-lg text-brand-brown mb-1">{recipe.name}</h3>
                        
                        {/* Nutritional info */}
                        {recipe.nutritionalInfo && (
                            <div className="mb-3 bg-brand-brown/5 rounded-xl p-3 border border-brand-brown/10 shadow-sm mt-3">
                                <div className="text-[10px] font-bold text-brand-brown/60 uppercase tracking-widest mb-2 flex justify-between items-center">
                                    <span>Valores Nutricionales</span>
                                    <span className="bg-white/60 px-2 py-0.5 rounded-md border border-brand-brown/5">{recipe.isPromo ? 'Promoción Completa' : (recipe.portionWeight ? `Porción: ${recipe.portionWeight}g` : 'Receta Entera')}</span>
                                </div>
                                {(() => {
                                    const factor = recipe.isPromo ? 1 : (!recipe.portionWeight ? 1 : (recipe.portionWeight > recipe.totalYieldWeight 
                                        ? 1 / recipe.totalYieldWeight 
                                        : recipe.portionWeight / recipe.totalYieldWeight));
                                    const cal = Math.round((recipe.nutritionalInfo?.calories || 0) * factor);
                                    const prot = Math.round((recipe.nutritionalInfo?.protein || 0) * factor);
                                    const carbs = Math.round((recipe.nutritionalInfo?.carbs || 0) * factor);
                                    const fat = Math.round((recipe.nutritionalInfo?.fat || 0) * factor);
                                    return (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col bg-orange-50 text-orange-800 px-2.5 py-1.5 rounded-lg border border-orange-100/50 shadow-sm">
                                                <span className="text-sm font-black">{cal}</span>
                                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">Calorías (kcal)</span>
                                            </div>
                                            <div className="flex flex-col bg-blue-50 text-blue-800 px-2.5 py-1.5 rounded-lg border border-blue-100/50 shadow-sm">
                                                <span className="text-sm font-black">{prot}g</span>
                                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">Proteínas</span>
                                            </div>
                                            <div className="flex flex-col bg-yellow-50 text-yellow-800 px-2.5 py-1.5 rounded-lg border border-yellow-100/50 shadow-sm">
                                                <span className="text-sm font-black">{carbs}g</span>
                                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">Carbohidratos</span>
                                            </div>
                                            <div className="flex flex-col bg-red-50 text-red-800 px-2.5 py-1.5 rounded-lg border border-red-100/50 shadow-sm">
                                                <span className="text-sm font-black">{fat}g</span>
                                                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80 mt-0.5">Grasas Totales</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {recipe.catalogDescription && recipe.catalogDescription.trim() && (
                            <div className="mt-2 mb-4 text-brand-accent font-bold text-sm flex items-center gap-1 group/btn w-fit">
                                <span className="group-hover/btn:underline">Conocer más detalles</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
                            </div>
                        )}

                        <div className="mt-auto flex items-center justify-between pt-3 border-t border-brand-brown/10" onClick={e => e.stopPropagation()}>
                            <span className="text-2xl font-bold text-brand-brown">${recipe.catalogPrice?.toLocaleString() || '0'}</span>
                            {inCart ? (
                                <div className="flex items-center gap-2 bg-brand-brown/5 rounded-xl p-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(recipe.id, inCart.quantity - 1); }}
                                        className="w-8 h-8 rounded-lg bg-white text-brand-brown font-bold shadow-sm hover:bg-brand-brown/10 transition-colors flex items-center justify-center"
                                    >−</button>
                                    <span className="w-6 text-center font-bold text-brand-brown">{inCart.quantity}</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(recipe.id, inCart.quantity + 1); }}
                                        className="w-8 h-8 rounded-lg bg-white text-brand-brown font-bold shadow-sm hover:bg-brand-brown/10 transition-colors flex items-center justify-center"
                                    >+</button>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAddToCart(recipe); }}
                                    className="py-2 px-4 warm-gradient-brown text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity btn-glow"
                                >
                                    Agregar
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* BACK */}
                <div 
                    className="absolute inset-0 glass-card rounded-2xl p-5 flex flex-col [transform:rotateY(180deg)] [backface-visibility:hidden] overflow-hidden bg-white/95 backdrop-blur-xl"
                    onClick={() => setIsFlipped(false)}
                >
                    <div className="flex justify-between items-center border-b border-brand-brown/10 pb-3 mb-3">
                        <h3 className="font-serif font-bold text-lg text-brand-brown flex-1 pr-2">{recipe.name}</h3>
                        <button onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-brown/10 text-brand-brown hover:bg-brand-brown/20 transition-colors flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-brand-brown/80 text-sm whitespace-pre-wrap leading-relaxed cursor-default" onClick={e => e.stopPropagation()}>
                        {recipe.catalogDescription}
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-brand-brown/10" onClick={e => e.stopPropagation()}>
                        <span className="text-xl font-bold text-brand-brown">${recipe.catalogPrice?.toLocaleString() || '0'}</span>
                        {inCart ? (
                            <div className="flex items-center gap-2 bg-brand-brown/5 rounded-xl p-1">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(recipe.id, inCart.quantity - 1); }}
                                    className="w-8 h-8 rounded-lg bg-white text-brand-brown font-bold shadow-sm hover:bg-brand-brown/10 transition-colors flex items-center justify-center"
                                >−</button>
                                <span className="w-6 text-center font-bold text-brand-brown">{inCart.quantity}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(recipe.id, inCart.quantity + 1); }}
                                    className="w-8 h-8 rounded-lg bg-white text-brand-brown font-bold shadow-sm hover:bg-brand-brown/10 transition-colors flex items-center justify-center"
                                >+</button>
                            </div>
                        ) : (
                            <button
                                onClick={(e) => { e.stopPropagation(); onAddToCart(recipe); }}
                                className="py-2 px-4 warm-gradient-brown text-white text-sm font-bold rounded-xl hover:opacity-90 transition-opacity btn-glow"
                            >
                                Agregar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const CatalogPage: React.FC<CatalogPageProps> = ({ userId }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [shopName, setShopName] = useState('');
    const [shopLogo, setShopLogo] = useState('');
    const [shopWhatsapp, setShopWhatsapp] = useState('');
    const [sections, setSections] = useState<string[]>([]);
    
    // Search and Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSection, setActiveSection] = useState<string | null>(null);

    // Cart state
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCart, setShowCart] = useState(false);

    // Checkout state
    const [showCheckout, setShowCheckout] = useState(false);
    const [clientName, setClientName] = useState('');
    const [clientPhone, setClientPhone] = useState('');
    const [clientAddress, setClientAddress] = useState('');
    const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
    const [deliveryDate, setDeliveryDate] = useState('');
    const [deliveryTime, setDeliveryTime] = useState('');
    const [clientNotes, setClientNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);

    // Fetch shop profile
    useEffect(() => {
        if (!userId) return;
        const fetchProfile = async () => {
            try {
                const profileDoc = await getDoc(doc(db, 'userProfiles', userId));
                if (profileDoc.exists()) {
                    const data = profileDoc.data();
                    setShopName(data.companyName || 'Tienda');
                    setShopLogo(data.logoUrl || '');
                    setShopWhatsapp(data.whatsappPhone || '');
                    setSections(data.catalogSections || []);
                }
            } catch (err) {
                console.error('Error fetching profile:', err);
            }
        };
        fetchProfile();
    }, [userId]);

    // Fetch catalog recipes
    useEffect(() => {
        if (!userId) return;
        const q = query(
            collection(db, 'recipes'),
            where('userId', '==', userId),
            where('showInCatalog', '==', true)
        );
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
            data.sort((a, b) => (a.catalogOrder || 999) - (b.catalogOrder || 999) || a.name.localeCompare(b.name));
            setRecipes(data);
            setLoading(false);
            setError(false);
        }, (err) => {
            console.error('Error loading catalog:', err);
            setLoading(false);
            setError(true);
        });
        return () => unsub();
    }, [userId]);

    const cartTotal = cart.reduce((sum, item) => sum + (item.recipe.catalogPrice || 0) * item.quantity, 0);
    const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const addToCart = (recipe: Recipe) => {
        setCart(prev => {
            const existing = prev.find(i => i.recipe.id === recipe.id);
            if (existing) {
                return prev.map(i => i.recipe.id === recipe.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { recipe, quantity: 1 }];
        });
    };

    const updateQuantity = (recipeId: string, qty: number) => {
        if (qty <= 0) {
            setCart(prev => prev.filter(i => i.recipe.id !== recipeId));
        } else {
            setCart(prev => prev.map(i => i.recipe.id === recipeId ? { ...i, quantity: qty } : i));
        }
    };

    const removeFromCart = (recipeId: string) => {
        setCart(prev => prev.filter(i => i.recipe.id !== recipeId));
    };

    const handleSubmitOrder = async () => {
        if (!clientName.trim()) { alert('Por favor ingresá tu nombre'); return; }
        if (!clientPhone.trim()) { alert('Por favor ingresá tu teléfono'); return; }
        if (deliveryMethod === 'delivery' && !clientAddress.trim()) { alert('Por favor ingresá tu dirección para el envío'); return; }
        if (!deliveryDate) { alert('Por favor seleccioná una fecha de entrega'); return; }
        if (cart.length === 0) { alert('Tu carrito está vacío'); return; }

        setIsSubmitting(true);
        try {
            const [y, m, d] = deliveryDate.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);

            const orderItems = cart.map(item => ({
                id: item.recipe.id,
                recipeId: item.recipe.id,
                name: item.recipe.name,
                amount: item.recipe.totalYieldWeight || 0,
                unit: 'un',
                quantity: item.quantity,
                price: item.recipe.catalogPrice || 0,
                cost: item.recipe.isPromo ? (item.recipe.totalCost * item.quantity) : ((item.recipe.totalYieldWeight || 0) * item.recipe.costPerGram * item.quantity),
            }));

            await addDoc(collection(db, 'orders'), {
                userId,
                clientId: '',
                clientName: clientName.trim(),
                items: orderItems,
                deliveryDate: dateObj,
                deliveryTime: deliveryTime || '',
                status: 'pending',
                total: cartTotal,
                deposit: 0,
                createdAt: new Date(),
                source: 'catalog',
                clientPhone: clientPhone.trim(),
                clientAddress: deliveryMethod === 'delivery' ? clientAddress.trim() : '',
                clientNotes: clientNotes.trim(),
                deliveryMethod,
                isRead: false,
            });

            if (shopWhatsapp) {
                const itemsText = cart.map(item => `${item.quantity}x ${item.recipe.name}`).join('%0A');
                let text = `Hola *${shopName || 'Tienda'}*! Acabo de hacer un pedido desde el catálogo digital:%0A%0A`;
                text += `*Mi Nombre:* ${clientName.trim()}%0A`;
                text += `*Mi Teléfono:* ${clientPhone.trim()}%0A`;
                text += `*Entrega:* ${deliveryMethod === 'pickup' ? 'Retiro en Local' : 'Envío a Domicilio'}${deliveryMethod === 'delivery' ? ` en ${clientAddress.trim()}` : ''}%0A`;
                text += `*Fecha de Entrega:* ${deliveryDate.split('-').reverse().join('/')} ${deliveryTime ? `a las ${deliveryTime}hs` : ''}%0A%0A`;
                text += `*Mi Pedido:*%0A${itemsText}%0A%0A`;
                text += `*Total Estimado:* $${cartTotal.toLocaleString()}%0A%0A`;
                text += `Aguardamos tu confirmación. ¡Gracias!`;
                
                window.open(`https://wa.me/${shopWhatsapp}?text=${text}`, '_blank');
            }

            setOrderSuccess(true);
            setCart([]);
        } catch (err) {
            console.error('Error submitting order:', err);
            alert('Error al enviar el pedido. Intentá de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Set min date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDateAvailable = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    if (loading) {
        return (
            <div className="min-h-screen warm-gradient-bg flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-brand-brown/20 border-t-brand-brown rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-brand-brown/60 font-medium">Cargando catálogo...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen warm-gradient-bg flex items-center justify-center p-4">
                <div className="glass-card-strong rounded-3xl p-8 max-w-md w-full text-center animate-fade-in-up">
                    <div className="text-5xl mb-4">⚙️</div>
                    <h2 className="text-2xl font-serif font-bold text-brand-brown mb-2">Catálogo en Configuración</h2>
                    <p className="text-brand-brown/70 mb-4">
                        El catálogo se está configurando. Si sos el dueño, actualizá las reglas de Firestore para permitir acceso público al catálogo.
                    </p>
                    <div className="bg-brand-brown/5 rounded-xl p-4 text-left text-xs text-brand-brown/60 font-mono">
                        <p className="mb-1 font-bold text-brand-brown text-sm font-sans">Reglas necesarias:</p>
                        <p>match /recipes/&#123;doc&#125; &#123;</p>
                        <p className="pl-4">allow read: if resource.data.showInCatalog == true;</p>
                        <p>&#125;</p>
                        <p className="mt-1">match /orders/&#123;doc&#125; &#123;</p>
                        <p className="pl-4">allow create: if true;</p>
                        <p>&#125;</p>
                        <p className="mt-1">match /userProfiles/&#123;doc&#125; &#123;</p>
                        <p className="pl-4">allow read: if true;</p>
                        <p>&#125;</p>
                    </div>
                </div>
            </div>
        );
    }

    if (orderSuccess) {
        return (
            <div className="min-h-screen warm-gradient-bg flex items-center justify-center p-4">
                <div className="glass-card-strong rounded-3xl p-8 max-w-md w-full text-center animate-fade-in-up">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-2xl font-serif font-bold text-brand-brown mb-2">¡Pedido Enviado!</h2>
                    <p className="text-brand-brown/70 mb-6">
                        Tu pedido fue recibido correctamente. {shopName ? `${shopName} se` : 'Se'} pondrá en contacto con vos para confirmar.
                    </p>
                    <div className="bg-brand-brown/5 rounded-xl p-4 mb-6 text-left space-y-1 text-sm text-brand-brown/70">
                        <p><strong>Nombre:</strong> {clientName}</p>
                        <p><strong>Teléfono:</strong> {clientPhone}</p>
                        <p><strong>Tipo de Entrega:</strong> {deliveryMethod === 'pickup' ? 'Retiro en Local' : 'Envío a Domicilio'}</p>
                        {deliveryMethod === 'delivery' && clientAddress && <p><strong>Dirección:</strong> {clientAddress}</p>}
                        <p><strong>Fecha:</strong> {deliveryDate.split('-').reverse().join('/')}</p>
                        {deliveryTime && <p><strong>Hora:</strong> {deliveryTime}hs</p>}
                    </div>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => {
                                setOrderSuccess(false);
                                setClientName(''); setClientPhone(''); setClientAddress('');
                                setDeliveryDate(''); setDeliveryTime(''); setClientNotes('');
                                setShowCheckout(false); setShowCart(false);
                            }}
                            className="w-full py-3 warm-gradient-brown text-white font-bold rounded-xl btn-glow shadow-md"
                        >
                            Hacer Otro Pedido
                        </button>
                        <button
                            onClick={() => {
                                // Hack para intentar evadir la restricción de seguridad del navegador para cerrar pestañas no abiertas por scripts
                                try {
                                    window.open('', '_self', '');
                                    window.close();
                                } catch (e) {
                                    console.log(e);
                                }
                                setTimeout(() => {
                                    window.location.replace('about:blank');
                                }, 100);
                            }}
                            className="w-full py-3 rounded-xl border-2 border-brand-brown/20 text-brand-brown font-bold hover:bg-brand-brown/5 transition-all"
                        >
                            Salir / Cerrar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen warm-gradient-bg pt-8">
            {/* Top Marquee Announcement */}
            <div className="fixed top-0 left-0 w-full bg-brand-brown text-yellow-100 border-b border-brand-brown py-1.5 overflow-hidden flex shadow-md z-[60] pointer-events-none">
                <div className="animate-marquee flex items-center font-bold text-[10px] md:text-xs tracking-[0.2em] uppercase whitespace-nowrap drop-shadow-sm">
                    <span className="mx-4 md:mx-8">✨ Reserva tu pedido con 24 hs de anticipación ✨</span>
                    <span className="mx-4 md:mx-8">✨ Reserva tu pedido con 24 hs de anticipación ✨</span>
                    <span className="mx-4 md:mx-8">✨ Reserva tu pedido con 24 hs de anticipación ✨</span>
                    <span className="mx-4 md:mx-8">✨ Reserva tu pedido con 24 hs de anticipación ✨</span>
                    <span className="mx-4 md:mx-8">✨ Reserva tu pedido con 24 hs de anticipación ✨</span>
                </div>
            </div>

            {/* Floating Top Nav / Cart Button */}
            <div className="fixed top-10 right-4 md:top-12 md:right-8 z-40 animate-fade-in-up">
                <button
                    onClick={() => setShowCart(true)}
                    className="relative p-3.5 md:p-4 rounded-2xl bg-white/90 backdrop-blur-xl text-brand-brown shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white hover:scale-105 hover:shadow-[0_12px_40px_rgb(0,0,0,0.16)] transition-all duration-300 group"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 md:h-7 md:w-7 group-hover:rotate-[15deg] transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                    </svg>
                    {cartCount > 0 && (
                        <span className="absolute -top-2.5 -right-2.5 w-6 h-6 md:w-7 md:h-7 bg-brand-accent text-white text-[11px] md:text-[13px] font-black rounded-full flex items-center justify-center shadow-md animate-bounce-slow">
                            {cartCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Stunning Hero Section */}
            <header className="relative pt-24 pb-14 md:pt-32 md:pb-24 px-4 overflow-hidden">
                {/* Immersive Decorative Elements */}
                <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-brand-accent/20 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
                <div className="absolute bottom-[-10%] right-[-5%] w-[30rem] h-[30rem] bg-orange-300/20 rounded-full blur-[120px] pointer-events-none mix-blend-multiply"></div>
                <div className="absolute top-[20%] right-[10%] w-32 h-32 bg-yellow-200/40 rounded-full blur-[60px] pointer-events-none"></div>
                
                <div className="max-w-4xl mx-auto flex flex-col items-center text-center relative z-10 animate-fade-in-up">
                    <div className="relative group mb-8 md:mb-10 w-full flex justify-center mx-auto">
                        {/* Majestic Glow Effect */}
                        <div className="absolute inset-0 max-w-[10rem] max-h-[10rem] md:max-w-[14rem] md:max-h-[14rem] mx-auto bg-gradient-to-tr from-orange-200 via-brand-accent/40 to-yellow-100 rounded-full blur-2xl opacity-60 group-hover:opacity-80 transition duration-700 group-hover:scale-110"></div>
                        <img 
                            src={shopLogo || `${import.meta.env.BASE_URL}logo.png`} 
                            alt="Logo" 
                            className="relative w-44 h-44 md:w-60 md:h-60 rounded-full object-cover object-center border-[6px] md:border-[8px] border-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] bg-white transform transition duration-700 group-hover:scale-105 group-hover:rotate-3" 
                        />
                    </div>
                    
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif font-black text-brand-brown tracking-tighter mb-5 md:mb-6 drop-shadow-sm leading-[1.1] md:leading-[1.05] px-2">
                        {shopName || 'Nuestro Catálogo'}
                    </h1>
                    
                    <div className="h-1.5 md:h-2 w-24 md:w-32 bg-gradient-to-r from-brand-accent to-orange-400 rounded-full mb-6 md:mb-8 opacity-90 shadow-sm"></div>

                    <p className="text-brand-brown/80 uppercase tracking-[0.2em] md:tracking-[0.25em] text-xs md:text-sm font-bold bg-white/70 px-6 py-2.5 md:px-8 md:py-3 rounded-full inline-block backdrop-blur-md shadow-sm border border-white/60">
                        Descubre Nuestra Selección
                    </p>
                </div>
            </header>

            {/* Search and Filters */}
            {recipes.length > 0 && (
                <div className="max-w-6xl mx-auto px-4 mb-4 relative z-20">
                    <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 shadow-sm border border-brand-brown/10 flex flex-col md:flex-row gap-4 items-center justify-between">
                        {/* Search Bar */}
                        <div className="relative w-full md:w-96">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-brand-brown/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Buscar productos..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border-none ring-1 ring-brand-brown/20 focus:ring-2 focus:ring-brand-accent bg-white/80 outline-none text-brand-brown transition-all"
                            />
                        </div>

                        {/* Category Pills */}
                        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-center md:justify-end">
                            <button
                                onClick={() => setActiveSection(null)}
                                className={`px-3.5 py-1.5 rounded-full whitespace-nowrap text-[11px] md:text-xs font-bold transition-all border ${activeSection === null ? 'bg-brand-brown text-white border-brand-brown shadow-sm' : 'bg-white/60 border-brand-brown/10 text-brand-brown/70 hover:bg-brand-brown/10 hover:text-brand-brown'}`}
                            >
                                Todos
                            </button>
                            {sections.map(sec => (
                                <button
                                    key={sec}
                                    onClick={() => setActiveSection(sec)}
                                    className={`px-3.5 py-1.5 rounded-full whitespace-nowrap text-[11px] md:text-xs font-bold transition-all border ${activeSection === sec ? 'bg-brand-brown text-white border-brand-brown shadow-sm' : 'bg-white/60 border-brand-brown/10 text-brand-brown/70 hover:bg-brand-brown/10 hover:text-brand-brown'}`}
                                >
                                    {sec}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Products Grid */}
            <main className="max-w-6xl mx-auto px-4 py-8 relative z-10 min-h-[50vh]">
                {recipes.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4">🍰</div>
                        <h2 className="text-xl font-serif font-bold text-brand-brown mb-2">Catálogo en Preparación</h2>
                        <p className="text-brand-brown/60">Pronto encontrarás nuestros productos aquí.</p>
                    </div>
                ) : (
                    <>
                        {(() => {
                            let filteredRecipes = recipes;

                            // Apply text search
                            if (searchQuery.trim()) {
                                const q = searchQuery.toLowerCase();
                                filteredRecipes = filteredRecipes.filter(r => 
                                    r.name.toLowerCase().includes(q) || 
                                    (r.catalogDescription && r.catalogDescription.toLowerCase().includes(q))
                                );
                            }

                            // Apply section filter
                            if (activeSection) {
                                filteredRecipes = filteredRecipes.filter(r => r.catalogSection === activeSection);
                            }

                            if (filteredRecipes.length === 0) {
                                return (
                                    <div className="text-center py-16 glass-card rounded-3xl animate-fade-in-up">
                                        <div className="text-5xl mb-4">🔍</div>
                                        <h2 className="text-xl font-serif font-bold text-brand-brown mb-2">No se encontraron productos</h2>
                                        <p className="text-brand-brown/60">Intenta buscar con otra palabra o elimina los filtros.</p>
                                        <button 
                                            onClick={() => { setSearchQuery(''); setActiveSection(null); }}
                                            className="mt-6 px-6 py-2 bg-brand-brown/10 hover:bg-brand-brown/20 text-brand-brown font-bold rounded-full transition-colors"
                                        >
                                            Limpiar Filtros
                                        </button>
                                    </div>
                                );
                            }

                            const groupedRecipes = new Map<string, Recipe[]>();
                            const unassigned: Recipe[] = [];

                            if (activeSection) {
                                groupedRecipes.set(activeSection, filteredRecipes);
                            } else {
                                sections.forEach(sec => groupedRecipes.set(sec, []));
                                filteredRecipes.forEach(recipe => {
                                    const sec = recipe.catalogSection;
                                    if (sec && groupedRecipes.has(sec)) {
                                        groupedRecipes.get(sec)!.push(recipe);
                                    } else if (sec) {
                                        if (!groupedRecipes.has(sec)) groupedRecipes.set(sec, []);
                                        groupedRecipes.get(sec)!.push(recipe);
                                    } else {
                                        unassigned.push(recipe);
                                    }
                                });
                            }

                            const sectionsToRender = Array.from(groupedRecipes.entries()).filter(([_, group]) => group.length > 0);
                            
                            if (unassigned.length > 0) {
                                if (sectionsToRender.length === 0) {
                                    sectionsToRender.push(['Nuestros Productos', unassigned]);
                                } else {
                                    sectionsToRender.push(['Otros Productos', unassigned]);
                                }
                            }

                            return (
                                <div className="space-y-16">
                                    {sectionsToRender.map(([sectionName, groupRecipes]) => (
                                        <div key={sectionName}>
                                            <div className="flex items-center justify-center gap-6 mb-8">
                                                <div className="h-px bg-brand-brown/20 flex-1 md:flex-none md:w-24"></div>
                                                <h2 className="text-2xl md:text-3xl font-serif font-bold text-brand-brown uppercase tracking-widest text-center">{sectionName}</h2>
                                                <div className="h-px bg-brand-brown/20 flex-1 md:flex-none md:w-24"></div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                                {groupRecipes.map(recipe => {
                                                    const inCart = cart.find(i => i.recipe.id === recipe.id);
                                                    return (
                                                        <ProductCard 
                                                            key={recipe.id} 
                                                            recipe={recipe} 
                                                            inCart={inCart} 
                                                            onAddToCart={addToCart} 
                                                            onUpdateQuantity={updateQuantity} 
                                                        />
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </>
                )}
            </main>

            {/* Footer */}
            <footer className="relative w-full bg-brand-brown text-white/80 pt-16 pb-24 md:pb-12 border-t-[8px] border-brand-accent rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-20">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
                    <div className="flex flex-col items-center md:items-start">
                        {shopLogo && (
                            <img src={shopLogo} alt="Logo" className="w-16 h-16 rounded-full object-cover mb-4 border-2 border-white/20" />
                        )}
                        <h3 className="font-serif text-3xl font-black text-white mb-4 tracking-wide">{shopName || 'Alternativa Keto'}</h3>
                        <p className="text-sm leading-relaxed max-w-sm">
                            Ofrecemos los mejores productos artesanales pensados para tu bienestar. Elaborados con amor y los mejores ingredientes seleccionados.
                        </p>
                    </div>
                    
                    <div className="flex flex-col items-center md:items-start">
                        <h3 className="font-bold text-white mb-6 uppercase tracking-[0.2em] text-sm">Información</h3>
                        <ul className="space-y-4 text-sm font-medium">
                            <li className="flex items-center gap-3"><span className="text-xl">🏪</span> Retiro en nuestro local</li>
                            <li className="flex items-center gap-3"><span className="text-xl">🛵</span> Envíos a domicilio a coordinar</li>
                            <li className="flex items-center gap-3"><span className="text-xl">🕒</span> Pedidos con 24hs de anticipación</li>
                        </ul>
                    </div>
                    
                    <div className="flex flex-col items-center md:items-start">
                        <h3 className="font-bold text-white mb-6 uppercase tracking-[0.2em] text-sm">Contacto Rápido</h3>
                        <ul className="space-y-3 w-full max-w-[200px]">
                            <li>
                                <a href="https://instagram.com/alternativaketo" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-brand-brown hover:bg-white transition-colors bg-white/10 py-3 px-5 rounded-2xl border border-white/20 w-full font-bold">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                                    @alternativaketo
                                </a>
                            </li>
                            <li>
                                <a href={`https://wa.me/${shopWhatsapp || '5491132427375'}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-brand-brown hover:bg-brand-accent transition-colors bg-brand-accent/20 py-3 px-5 rounded-2xl border border-brand-accent/50 w-full text-white font-bold">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    WhatsApp
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div className="max-w-6xl mx-auto px-6 mt-12 pt-6 border-t border-white/10 text-center flex flex-col items-center justify-center opacity-70">
                    <p className="text-xs tracking-wider">© {new Date().getFullYear()} {shopName || 'Alternativa Keto'}. Todos los derechos reservados.</p>
                </div>
            </footer>

            {/* Floating cart button (mobile) */}
            {cartCount > 0 && !showCart && !showCheckout && (
                <div className="fixed bottom-6 left-4 right-4 z-30 md:hidden">
                    <button
                        onClick={() => setShowCart(true)}
                        className="w-full py-4 warm-gradient-brown text-white font-bold rounded-2xl shadow-xl flex items-center justify-center gap-3 btn-glow"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                        </svg>
                        Ver Carrito ({cartCount}) · ${cartTotal.toLocaleString()}
                    </button>
                </div>
            )}

            {/* Cart Slide-over */}
            {showCart && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowCart(false)}>
                    <div
                        className="w-full max-w-md bg-white/95 backdrop-blur-xl h-full shadow-2xl flex flex-col animate-fade-in-up"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Cart Header */}
                        <div className="p-4 border-b border-brand-brown/10 flex items-center justify-between">
                            <h2 className="text-xl font-serif font-bold text-brand-brown">Tu Pedido</h2>
                            <button onClick={() => setShowCart(false)} className="p-2 rounded-full hover:bg-brand-brown/10 text-brand-brown">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {cart.length === 0 ? (
                                <div className="text-center py-12 text-brand-brown/40">
                                    <div className="text-4xl mb-3">🛒</div>
                                    <p className="font-medium">Tu carrito está vacío</p>
                                    <p className="text-sm">Agregá productos del catálogo</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.recipe.id} className="flex items-center gap-3 bg-brand-brown/5 rounded-xl p-3">
                                        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/80 border border-brand-brown/10">
                                            {item.recipe.catalogImages && item.recipe.catalogImages.length > 0 ? (
                                                <img src={item.recipe.catalogImages[0]} alt="" className="w-full h-full object-contain p-0.5" />
                                            ) : item.recipe.catalogImage ? (
                                                <img src={item.recipe.catalogImage} alt="" className="w-full h-full object-contain p-0.5" />
                                            ) : (
                                                <div className="w-full h-full warm-gradient-brown flex items-center justify-center text-xl">🍰</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm text-brand-brown truncate">{item.recipe.name}</h4>
                                            <p className="text-xs text-brand-brown/60">${item.recipe.catalogPrice?.toLocaleString()} c/u</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button onClick={() => updateQuantity(item.recipe.id, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-white text-brand-brown font-bold text-sm shadow-sm hover:bg-brand-brown/10 flex items-center justify-center">−</button>
                                            <span className="w-5 text-center text-sm font-bold text-brand-brown">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.recipe.id, item.quantity + 1)} className="w-7 h-7 rounded-lg bg-white text-brand-brown font-bold text-sm shadow-sm hover:bg-brand-brown/10 flex items-center justify-center">+</button>
                                        </div>
                                        <button onClick={() => removeFromCart(item.recipe.id)} className="p-1 text-red-400 hover:text-red-600">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Cart Footer */}
                        {cart.length > 0 && (
                            <div className="p-4 border-t border-brand-brown/10 bg-brand-cream/30 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-brand-brown">Total:</span>
                                    <span className="text-2xl font-bold text-brand-brown">${cartTotal.toLocaleString()}</span>
                                </div>
                                <button
                                    onClick={() => { setShowCart(false); setShowCheckout(true); }}
                                    className="w-full py-3.5 warm-gradient-brown text-white font-bold rounded-xl btn-glow text-lg"
                                >
                                    Continuar con el Pedido
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            {showCheckout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-lg glass-card-strong rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
                        {/* Header */}
                        <div className="p-5 border-b border-brand-brown/10 flex items-center justify-between">
                            <h2 className="text-xl font-serif font-bold text-brand-brown">Completar Pedido</h2>
                            <button onClick={() => setShowCheckout(false)} className="p-2 rounded-full hover:bg-brand-brown/10 text-brand-brown">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Form */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* Order Summary */}
                            <div className="bg-brand-brown/5 rounded-xl p-4 space-y-2">
                                <h3 className="text-sm font-bold text-brand-brown mb-2">Resumen del Pedido</h3>
                                {cart.map(item => (
                                    <div key={item.recipe.id} className="flex justify-between text-sm text-brand-brown/70">
                                        <span>{item.quantity}x {item.recipe.name}</span>
                                        <span className="font-medium">${((item.recipe.catalogPrice || 0) * item.quantity).toLocaleString()}</span>
                                    </div>
                                ))}
                                <div className="border-t border-brand-brown/10 pt-2 flex justify-between font-bold text-brand-brown">
                                    <span>Total</span>
                                    <span>${cartTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Client info */}
                            <div>
                                <label className="block text-sm font-bold text-brand-brown mb-1">Nombre *</label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={e => setClientName(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white"
                                    placeholder="Tu nombre completo"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-brand-brown mb-1">Teléfono *</label>
                                <input
                                    type="tel"
                                    value={clientPhone}
                                    onChange={e => setClientPhone(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white"
                                    placeholder="Ej. 11-2345-6789"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-brand-brown mb-2">Método de Entrega *</label>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setDeliveryMethod('pickup')}
                                        className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${deliveryMethod === 'pickup' ? 'border-brand-accent bg-brand-accent/10 text-brand-brown font-bold' : 'border-brand-brown/10 hover:border-brand-brown/30 text-brand-brown/70 bg-white'}`}
                                    >
                                        <span>🏪</span> Retiro yo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeliveryMethod('delivery')}
                                        className={`p-3 rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${deliveryMethod === 'delivery' ? 'border-brand-accent bg-brand-accent/10 text-brand-brown font-bold' : 'border-brand-brown/10 hover:border-brand-brown/30 text-brand-brown/70 bg-white'}`}
                                    >
                                        <span>🛵</span> Quiero envío
                                    </button>
                                </div>
                            </div>
                            {deliveryMethod === 'delivery' && (
                                <div>
                                    <label className="block text-sm font-bold text-brand-brown mb-1">Dirección de Envío *</label>
                                    <input
                                        type="text"
                                        value={clientAddress}
                                        onChange={e => setClientAddress(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white"
                                        placeholder="Tu dirección completa para el envío"
                                        required={deliveryMethod === 'delivery'}
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-brand-brown mb-1">Fecha de Entrega *</label>
                                    <input
                                        type="date"
                                        value={deliveryDate}
                                        onChange={e => setDeliveryDate(e.target.value)}
                                        min={minDateAvailable}
                                        className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-brand-brown mb-1">Hora <span className="font-normal text-brand-brown/50">(opcional)</span></label>
                                    <input
                                        type="time"
                                        value={deliveryTime}
                                        onChange={e => setDeliveryTime(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-brand-brown mb-1">Preferencias del pedido <span className="font-normal text-brand-brown/50">(opcional)</span></label>
                                <textarea
                                    value={clientNotes}
                                    onChange={e => setClientNotes(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-white resize-none"
                                    rows={2}
                                    placeholder="Ej. Sin frutos secos, con alguna dedicatoria, etc..."
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="p-5 border-t border-brand-brown/10 flex gap-3">
                            <button
                                onClick={() => { setShowCheckout(false); setShowCart(true); }}
                                className="px-5 py-3 border border-brand-brown/20 rounded-xl text-brand-brown font-bold hover:bg-brand-brown/5 transition-colors"
                            >
                                Volver
                            </button>
                            <button
                                onClick={handleSubmitOrder}
                                disabled={isSubmitting}
                                className="flex-1 py-3 warm-gradient-brown text-white font-bold rounded-xl btn-glow disabled:opacity-50 text-lg"
                            >
                                {isSubmitting ? 'Enviando...' : `Enviar Pedido · $${cartTotal.toLocaleString()}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CatalogPage;

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
        }, 3200);
        return () => clearInterval(interval);
    }, [images]);

    if (!images || images.length === 0) {
        return (
            <div className="w-full aspect-[4/3] bg-gradient-to-br from-brand-beige via-[#F7F2EC] to-brand-cream/80 flex flex-col items-center justify-center text-brand-brown/40 border-b border-brand-brown/5">
                <span className="text-4xl filter drop-shadow-sm mb-1">🧁</span>
                <span className="text-[11px] font-serif italic text-brand-brown/50">Pastelería Artesanal</span>
            </div>
        );
    }

    if (images.length === 1) {
        return (
            <div className="relative w-full aspect-[4/3] overflow-hidden bg-brand-cream/40 border-b border-brand-brown/5">
                <img 
                    src={images[0]} 
                    alt={alt} 
                    className="w-full h-full object-cover transition-transform duration-700 ease-out hover:scale-105" 
                />
            </div>
        );
    }

    return (
        <div className="relative w-full aspect-[4/3] overflow-hidden group bg-brand-cream/40 border-b border-brand-brown/5">
            {images.map((imgSrc, idx) => (
                <img 
                    key={idx}
                    src={imgSrc} 
                    alt={`${alt} - ${idx + 1}`} 
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out group-hover:scale-105 ${
                        idx === currentIndex ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-98 z-0 pointer-events-none'
                    }`} 
                />
            ))}
            
            {/* Arrows */}
            <div className="absolute inset-0 flex items-center justify-between p-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentIndex(prev => prev === 0 ? images.length - 1 : prev - 1); }}
                    className="w-7 h-7 rounded-full bg-white/85 backdrop-blur-md text-brand-brown flex items-center justify-center hover:bg-white transition-all shadow-md active:scale-95 border border-white/60"
                    aria-label="Foto anterior"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                </button>
                <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCurrentIndex(prev => prev === images.length - 1 ? 0 : prev + 1); }}
                    className="w-7 h-7 rounded-full bg-white/85 backdrop-blur-md text-brand-brown flex items-center justify-center hover:bg-white transition-all shadow-md active:scale-95 border border-white/60"
                    aria-label="Siguiente foto"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                </button>
            </div>

            {/* Dots */}
            <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5 z-20">
                {images.map((_, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === currentIndex 
                                ? 'w-4 bg-white shadow-sm' 
                                : 'w-1.5 bg-white/60 hover:bg-white/80'
                        }`}
                        aria-label={`Ver foto ${idx + 1}`}
                    />
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
        <div className="relative group w-full h-full perspective-[1200px]">
            <div 
                className={`w-full h-full relative transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
                {/* FRONT */}
                <div 
                    onClick={() => { if (recipe.catalogDescription?.trim()) setIsFlipped(true); }}
                    className={`rounded-3xl overflow-hidden flex flex-col h-full w-full [backface-visibility:hidden] bg-white/85 backdrop-blur-md border border-white/80 shadow-[0_8px_30px_rgba(93,58,41,0.06)] hover:shadow-[0_20px_45px_rgba(93,58,41,0.12)] transition-all duration-500 hover:-translate-y-1.5 ${
                        recipe.catalogDescription?.trim() ? 'cursor-pointer' : ''
                    }`}
                >
                    {/* Media Container */}
                    <div className="relative">
                        <ImageCarousel 
                            images={recipe.catalogImages && recipe.catalogImages.length > 0 ? recipe.catalogImages : (recipe.catalogImage ? [recipe.catalogImage] : [])} 
                            alt={recipe.name} 
                        />
                        {recipe.catalogPrice !== undefined && (
                            <div className="absolute top-3.5 right-3.5 z-20 bg-white/95 backdrop-blur-md text-brand-brown font-serif font-black text-base md:text-lg px-3.5 py-1 rounded-2xl shadow-[0_4px_16px_rgba(93,58,41,0.12)] border border-white/80">
                                ${recipe.catalogPrice.toLocaleString()}
                            </div>
                        )}
                        {recipe.isPromo && (
                            <div className="absolute top-3.5 left-3.5 z-20 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-sans text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md">
                                ★ Promo
                            </div>
                        )}
                    </div>

                    {/* Body */}
                    <div className="p-5 md:p-6 flex flex-col flex-1">
                        <h3 className="font-serif font-bold text-lg md:text-xl text-brand-brown mb-1.5 leading-snug group-hover:text-brand-accent transition-colors">
                            {recipe.name}
                        </h3>
                        
                        {/* Nutritional info micro-grid */}
                        {recipe.nutritionalInfo && (
                            <div className="mb-3.5 bg-gradient-to-b from-[#FBF8F4] to-brand-cream/80 rounded-2xl p-3 border border-brand-accent/20 shadow-xs mt-2">
                                <div className="text-[10px] font-bold text-brand-brown/70 uppercase tracking-widest mb-2 flex justify-between items-center">
                                    <span className="flex items-center gap-1.5">
                                        <span className="text-xs">🌿</span>
                                        <span>Info Nutricional</span>
                                    </span>
                                    <span className="bg-white/90 px-2 py-0.5 rounded-full text-[9px] font-bold border border-brand-brown/10 text-brand-brown/75">
                                        {recipe.isPromo ? 'Promo' : (recipe.portionWeight ? `Porción ${recipe.portionWeight}g` : 'Total')}
                                    </span>
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
                                        <div className="grid grid-cols-4 gap-1.5 text-center">
                                            <div className="flex flex-col bg-white/90 py-1.5 px-1 rounded-xl border border-stone-200/60 shadow-xs">
                                                <span className="text-xs font-black text-brand-brown">{cal}</span>
                                                <span className="text-[8px] font-bold uppercase tracking-tight text-brand-brown/60">kcal</span>
                                            </div>
                                            <div className="flex flex-col bg-emerald-50/80 py-1.5 px-1 rounded-xl border border-emerald-200/50 shadow-xs">
                                                <span className="text-xs font-black text-emerald-900">{prot}g</span>
                                                <span className="text-[8px] font-bold uppercase tracking-tight text-emerald-700">Prot</span>
                                            </div>
                                            <div className="flex flex-col bg-amber-50/90 py-1.5 px-1 rounded-xl border border-amber-200/60 shadow-xs">
                                                <span className="text-xs font-black text-amber-950">{carbs}g</span>
                                                <span className="text-[8px] font-bold uppercase tracking-tight text-amber-800">Carbs</span>
                                            </div>
                                            <div className="flex flex-col bg-orange-50/70 py-1.5 px-1 rounded-xl border border-orange-200/50 shadow-xs">
                                                <span className="text-xs font-black text-brand-brown">{fat}g</span>
                                                <span className="text-[8px] font-bold uppercase tracking-tight text-brand-brown/70">Grasas</span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Description link */}
                        {recipe.catalogDescription && recipe.catalogDescription.trim() && (
                            <div className="mt-auto mb-3.5 text-brand-accent hover:text-brand-brown font-semibold text-xs flex items-center gap-1.5 group/btn w-fit transition-colors pt-1">
                                <span className="group-hover/btn:underline">Ver detalles e ingredientes</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                </svg>
                            </div>
                        )}

                        {/* Action CTA */}
                        <div className="mt-auto pt-3.5 border-t border-brand-brown/10" onClick={e => e.stopPropagation()}>
                            {inCart ? (
                                <div className="flex items-center justify-between bg-brand-cream/80 rounded-2xl p-1.5 border border-brand-accent/30 shadow-xs">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(recipe.id, inCart.quantity - 1); }}
                                        className="w-9 h-9 rounded-xl bg-white text-brand-brown font-black shadow-sm hover:bg-brand-brown/10 transition-all flex items-center justify-center active:scale-90 text-base"
                                        aria-label="Disminuir cantidad"
                                    >−</button>
                                    <span className="text-center font-serif font-black text-base text-brand-brown px-3">
                                        {inCart.quantity}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); onUpdateQuantity(recipe.id, inCart.quantity + 1); }}
                                        className="w-9 h-9 rounded-xl bg-white text-brand-brown font-black shadow-sm hover:bg-brand-brown/10 transition-all flex items-center justify-center active:scale-90 text-base"
                                        aria-label="Aumentar cantidad"
                                    >+</button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onAddToCart(recipe); }}
                                    className="w-full py-3.5 warm-gradient-brown text-white text-sm font-bold rounded-2xl hover:opacity-95 transition-all btn-glow flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-brand-brown/15"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>Agregar al Pedido</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* BACK */}
                <div 
                    className="absolute inset-0 rounded-3xl p-6 flex flex-col [transform:rotateY(180deg)] [backface-visibility:hidden] overflow-hidden bg-white/95 backdrop-blur-2xl border border-white/90 shadow-xl"
                    onClick={() => setIsFlipped(false)}
                >
                    <div className="flex justify-between items-center border-b border-brand-brown/10 pb-3.5 mb-3.5">
                        <div>
                            <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block">Detalles del producto</span>
                            <h3 className="font-serif font-bold text-lg text-brand-brown leading-snug">{recipe.name}</h3>
                        </div>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setIsFlipped(false); }} 
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-brown/10 text-brand-brown hover:bg-brand-brown/20 transition-colors flex-shrink-0" 
                            title="Volver al frente"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div 
                        className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-brand-brown/85 text-sm whitespace-pre-wrap leading-relaxed cursor-default font-sans" 
                        onClick={e => e.stopPropagation()}
                    >
                        {recipe.catalogDescription}
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-brand-brown/10" onClick={e => e.stopPropagation()}>
                        <span className="text-xl font-serif font-black text-brand-brown">
                            ${recipe.catalogPrice?.toLocaleString() || '0'}
                        </span>
                        {inCart ? (
                            <div className="flex items-center gap-2 bg-brand-cream/80 rounded-2xl p-1 border border-brand-accent/30">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(recipe.id, inCart.quantity - 1); }}
                                    className="w-8 h-8 rounded-xl bg-white text-brand-brown font-black shadow-sm hover:bg-brand-brown/10 transition-all flex items-center justify-center active:scale-90"
                                >−</button>
                                <span className="w-6 text-center font-serif font-black text-brand-brown">{inCart.quantity}</span>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(recipe.id, inCart.quantity + 1); }}
                                    className="w-8 h-8 rounded-xl bg-white text-brand-brown font-black shadow-sm hover:bg-brand-brown/10 transition-all flex items-center justify-center active:scale-90"
                                >+</button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onAddToCart(recipe); }}
                                className="py-2.5 px-5 warm-gradient-brown text-white text-sm font-bold rounded-2xl hover:opacity-95 transition-all btn-glow flex items-center gap-1.5 active:scale-[0.98] shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Agregar</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const DEFAULT_WHATSAPP = '5491132427375';

const formatWhatsappDisplay = (phone: string) => {
    const raw = phone || DEFAULT_WHATSAPP;
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('54911') && digits.length >= 12) {
        return `11 ${digits.slice(5, 9)}-${digits.slice(9)}`;
    }
    if (digits.startsWith('549') && digits.length >= 12) {
        return `+54 9 ${digits.slice(3, 5)} ${digits.slice(5, 9)}-${digits.slice(9)}`;
    }
    if (digits.startsWith('11') && digits.length === 10) {
        return `11 ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone || '11 3242-7375';
};

const getCleanWhatsappNumber = (phone: string) => {
    return (phone || DEFAULT_WHATSAPP).replace(/\D/g, '');
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
        document.title = 'Alternativa Keto | Pastelería y Comida Keto en Berazategui';
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

    // Combine configured sections with any section in loaded recipes so ALL options are guaranteed visible
    const allSections = Array.from(
        new Set([
            ...sections,
            ...recipes.map(r => r.catalogSection).filter((s): s is string => Boolean(s && s.trim()))
        ])
    );

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

            const activeWhatsapp = getCleanWhatsappNumber(shopWhatsapp);
            if (activeWhatsapp) {
                const itemsText = cart.map(item => `• ${item.quantity}x ${item.recipe.name}`).join('%0A');
                let text = `¡Hola *${shopName || 'Alternativa Keto'}*! Acabo de hacer un pedido desde el catálogo digital:%0A%0A`;
                text += `👤 *Mi Nombre:* ${clientName.trim()}%0A`;
                text += `📱 *Mi Teléfono:* ${clientPhone.trim()}%0A`;
                if (deliveryMethod === 'delivery') {
                    text += `🚗 *Entrega:* Envío a Domicilio en *${clientAddress.trim()}*%0A`;
                    text += `⚠️ *(Envío por Uber a cargo del cliente)*%0A`;
                } else {
                    text += `🏪 *Entrega:* Retiro en Local (Berazategui)%0A`;
                }
                text += `📅 *Fecha de Entrega:* ${deliveryDate.split('-').reverse().join('/')} ${deliveryTime ? `a las ${deliveryTime}hs` : ''}%0A%0A`;
                text += `🛒 *Mi Pedido:*%0A${itemsText}%0A%0A`;
                text += `💰 *Total Estimado:* $${cartTotal.toLocaleString()}%0A%0A`;
                if (clientNotes.trim()) {
                    text += `📝 *Preferencias:* ${clientNotes.trim()}%0A%0A`;
                }
                text += `Aguardamos tu confirmación para coordinar los detalles. ¡Muchas gracias!`;
                
                window.open(`https://wa.me/${activeWhatsapp}?text=${text}`, '_blank');
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

    // Set min date to tomorrow (24h anticipation)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDateAvailable = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    if (loading) {
        return (
            <div className="min-h-screen warm-gradient-bg flex items-center justify-center">
                <div className="text-center p-8">
                    <div className="w-14 h-14 border-4 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-brand-brown font-serif text-lg font-medium">Preparando delicias keto...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen warm-gradient-bg flex items-center justify-center p-4">
                <div className="glass-card-strong rounded-3xl p-8 max-w-md w-full text-center animate-fade-in-up border border-white/80 shadow-2xl">
                    <div className="text-5xl mb-4">⚙️</div>
                    <h2 className="text-2xl font-serif font-bold text-brand-brown mb-2">Catálogo en Configuración</h2>
                    <p className="text-brand-brown/70 mb-4 text-sm">
                        El catálogo se está configurando. Si sos el dueño, actualizá las reglas de Firestore para permitir acceso público al catálogo.
                    </p>
                    <div className="bg-brand-brown/5 rounded-2xl p-4 text-left text-xs text-brand-brown/70 font-mono">
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
                <div className="glass-card-strong rounded-3xl p-8 md:p-10 max-w-lg w-full text-center animate-fade-in-up border border-white/80 shadow-2xl">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5 text-4xl shadow-inner">
                        ✓
                    </div>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">¡Confirmación Exitosa!</span>
                    <h2 className="text-3xl font-serif font-black text-brand-brown mt-1 mb-3">¡Pedido Enviado!</h2>
                    <p className="text-brand-brown/75 text-sm mb-6 leading-relaxed">
                        Tu pedido fue recibido con éxito. {shopName ? `${shopName} coordinará` : 'Coordinaremos'} con vos los detalles finales a través de WhatsApp.
                    </p>
                    
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 mb-6 text-left space-y-2 text-sm text-brand-brown/80 border border-brand-brown/10 shadow-xs">
                        <div className="flex justify-between border-b border-brand-brown/10 pb-2">
                            <span className="text-brand-brown/60">Cliente:</span>
                            <span className="font-bold text-brand-brown">{clientName}</span>
                        </div>
                        <div className="flex justify-between border-b border-brand-brown/10 pb-2">
                            <span className="text-brand-brown/60">Teléfono:</span>
                            <span className="font-bold text-brand-brown">{clientPhone}</span>
                        </div>
                        <div className="flex justify-between border-b border-brand-brown/10 pb-2">
                            <span className="text-brand-brown/60">Entrega:</span>
                            <span className="font-bold text-brand-brown">
                                {deliveryMethod === 'pickup' ? '🏪 Retiro en Local' : '🚗 Envío a Domicilio (Uber)'}
                            </span>
                        </div>
                        {deliveryMethod === 'delivery' && clientAddress && (
                            <div className="flex justify-between border-b border-brand-brown/10 pb-2">
                                <span className="text-brand-brown/60">Dirección:</span>
                                <span className="font-bold text-brand-brown text-right max-w-[200px] truncate">{clientAddress}</span>
                            </div>
                        )}
                        <div className="flex justify-between pt-1">
                            <span className="text-brand-brown/60">Fecha estimada:</span>
                            <span className="font-bold text-brand-brown">
                                {deliveryDate.split('-').reverse().join('/')} {deliveryTime ? `· ${deliveryTime}hs` : ''}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <a
                            href={`https://wa.me/${getCleanWhatsappNumber(shopWhatsapp)}?text=${encodeURIComponent(`¡Hola ${shopName || 'Alternativa Keto'}! Te escribo para confirmar mi pedido a nombre de ${clientName}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-4 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2.5 transition-all text-base btn-glow"
                        >
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            <span>Contactar por WhatsApp ({formatWhatsappDisplay(shopWhatsapp)})</span>
                        </a>
                        <button
                            type="button"
                            onClick={() => {
                                setOrderSuccess(false);
                                setClientName(''); setClientPhone(''); setClientAddress('');
                                setDeliveryDate(''); setDeliveryTime(''); setClientNotes('');
                                setShowCheckout(false); setShowCart(false);
                            }}
                            className="w-full py-3.5 warm-gradient-brown text-white font-bold rounded-2xl btn-glow shadow-md"
                        >
                            Hacer Otro Pedido
                        </button>
                        <button
                            type="button"
                            onClick={() => {
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
                            className="w-full py-3 rounded-2xl border border-brand-brown/20 text-brand-brown font-semibold hover:bg-brand-brown/5 transition-all text-sm"
                        >
                            Salir / Cerrar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen warm-gradient-bg relative text-brand-brown selection:bg-brand-accent/30 selection:text-brand-brown">
            {/* Top Marquee Announcement */}
            <div className="fixed top-0 left-0 w-full bg-[#422A1D] text-[#FDFBF7] border-b border-[#D4A373]/30 py-2 overflow-hidden flex shadow-md z-[60] pointer-events-none">
                <div className="animate-marquee flex items-center font-bold text-[10px] md:text-xs tracking-[0.25em] uppercase whitespace-nowrap text-yellow-100/95">
                    <span className="mx-6 md:mx-10 flex items-center gap-2"><span>✦</span> Reserva tu pedido con 24 hs de anticipación <span>✦</span></span>
                    <span className="mx-6 md:mx-10 flex items-center gap-2"><span>✦</span> Pastelería 100% Keto libre de azúcares <span>✦</span></span>
                    <span className="mx-6 md:mx-10 flex items-center gap-2"><span>✦</span> Reserva tu pedido con 24 hs de anticipación <span>✦</span></span>
                    <span className="mx-6 md:mx-10 flex items-center gap-2"><span>✦</span> Elaboración artesanal en Berazategui <span>✦</span></span>
                    <span className="mx-6 md:mx-10 flex items-center gap-2"><span>✦</span> Reserva tu pedido con 24 hs de anticipación <span>✦</span></span>
                </div>
            </div>

            {/* Floating Top Nav / Cart Pill */}
            <div className="fixed top-12 right-4 md:top-14 md:right-8 z-40 animate-fade-in">
                <button
                    type="button"
                    onClick={() => setShowCart(true)}
                    className="relative flex items-center gap-2.5 px-4 py-3 md:px-5 md:py-3.5 rounded-full bg-white/90 backdrop-blur-xl text-brand-brown shadow-[0_10px_30px_rgba(93,58,41,0.12)] border border-white hover:scale-105 hover:shadow-[0_14px_40px_rgba(93,58,41,0.18)] transition-all duration-300 group"
                    aria-label="Abrir carrito de compras"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 md:h-6 md:w-6 text-brand-brown group-hover:rotate-12 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span className="hidden sm:inline font-serif font-bold text-sm tracking-wide">
                        Carrito
                    </span>
                    {cartCount > 0 && (
                        <span className="w-5 h-5 md:w-6 md:h-6 bg-brand-accent text-white text-[11px] md:text-xs font-black rounded-full flex items-center justify-center shadow-md animate-bounce-slow">
                            {cartCount}
                        </span>
                    )}
                </button>
            </div>

            {/* Hero Header Section */}
            <header className="relative pt-28 pb-14 md:pt-36 md:pb-20 px-4 overflow-hidden">
                {/* Ambient Soft Glow Orbs */}
                <div className="absolute top-[-10%] left-[-8%] w-80 h-80 md:w-[32rem] md:h-[32rem] bg-[#E8D5C4]/35 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute bottom-[-10%] right-[-5%] w-80 h-80 md:w-[30rem] md:h-[30rem] bg-[#F5E6D3]/40 rounded-full blur-[120px] pointer-events-none"></div>
                <div className="absolute top-[25%] right-[15%] w-44 h-44 bg-[#FFE8D6]/35 rounded-full blur-[70px] pointer-events-none"></div>
                
                <div className="max-w-4xl mx-auto flex flex-col items-center text-center relative z-10 animate-fade-in-up">
                    {/* Small Bakery Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/70 border border-brand-accent/25 backdrop-blur-md shadow-xs mb-5">
                        <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-brand-accent">
                            ✦ REPOSTERÍA ARTESANAL & KETO ✦
                        </span>
                    </div>

                    {/* Logo with delicate rings */}
                    <div className="relative group mb-6 md:mb-8 flex justify-center">
                        <div className="absolute inset-0 max-w-[11rem] max-h-[11rem] md:max-w-[14rem] md:max-h-[14rem] mx-auto bg-gradient-to-tr from-[#E6CAAF]/60 to-[#F2D7BE]/40 rounded-full blur-2xl opacity-70 group-hover:opacity-90 transition duration-700 group-hover:scale-105"></div>
                        <img 
                            src={shopLogo || `${import.meta.env.BASE_URL}logo.png`} 
                            alt={shopName || 'Alternativa Keto'} 
                            className="relative w-40 h-40 md:w-52 md:h-52 rounded-full object-cover object-center border-4 md:border-6 border-white shadow-[0_16px_40px_rgba(93,58,41,0.12)] bg-white transition-transform duration-700 group-hover:scale-105 group-hover:rotate-1" 
                        />
                    </div>
                    
                    {/* Brand Title */}
                    <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-serif font-black text-brand-brown tracking-tight mb-3 md:mb-4 drop-shadow-xs leading-[1.08] px-2 hero-title-shadow">
                        {shopName || 'Alternativa Keto'}
                    </h1>

                    {/* Slogan */}
                    <p className="text-brand-brown/80 font-serif italic text-base sm:text-lg md:text-xl mb-6 max-w-xl mx-auto leading-relaxed">
                        Pastelería & cocina artesanal 100% libre de azúcares y harinas refinadas
                    </p>
                    
                    {/* Delicate Divider */}
                    <div className="flex items-center gap-3 w-40 md:w-56 justify-center mb-6 opacity-80">
                        <div className="h-px bg-gradient-to-r from-transparent via-brand-accent to-brand-accent/40 flex-1"></div>
                        <span className="text-brand-accent text-xs">✦</span>
                        <div className="h-px bg-gradient-to-l from-transparent via-brand-accent to-brand-accent/40 flex-1"></div>
                    </div>

                    {/* Location & Style Badges */}
                    <div className="flex flex-wrap items-center justify-center gap-2.5 mb-6">
                        <span className="text-brand-brown/90 uppercase tracking-[0.2em] text-xs font-bold bg-white/85 px-4 py-2 rounded-full inline-flex items-center gap-1.5 backdrop-blur-md shadow-xs border border-white/80">
                            <span>📍</span> Berazategui, Buenos Aires
                        </span>
                        <span className="text-brand-brown/90 uppercase tracking-[0.2em] text-xs font-bold bg-white/85 px-4 py-2 rounded-full inline-flex items-center gap-1.5 backdrop-blur-md shadow-xs border border-white/80 badge-shimmer">
                            <span>✨</span> Pastelería 100% Keto
                        </span>
                    </div>

                    {/* WhatsApp & Delivery Info Pills */}
                    <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl">
                        <a
                            href={`https://wa.me/${getCleanWhatsappNumber(shopWhatsapp)}?text=${encodeURIComponent('¡Hola! Me gustaría hacer una consulta sobre los productos de Alternativa Keto en Berazategui.')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold px-4 py-2 rounded-xl shadow-md shadow-emerald-600/15 hover:scale-105 active:scale-95 transition-all text-xs tracking-wide"
                        >
                            <svg className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            <span>WhatsApp: <strong className="underline decoration-white/40">{formatWhatsappDisplay(shopWhatsapp)}</strong></span>
                        </a>

                        <div className="flex items-center gap-2 bg-white/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-brand-brown/10 text-xs font-semibold text-brand-brown shadow-xs">
                            <span className="text-sm">🚗</span>
                            <span>Envíos vía <strong>Uber</strong> o Retiro en local</span>
                        </div>
                    </div>

                    {/* Artisan Quality Seals */}
                    <div className="mt-8 pt-6 border-t border-brand-brown/10 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs font-bold text-brand-brown/80">
                        <div className="flex items-center gap-2 bg-white/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/80 shadow-xs">
                            <span className="text-sm">🌱</span>
                            <span>Sin Azúcar Agregada</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/80 shadow-xs">
                            <span className="text-sm">🧁</span>
                            <span>Harinas Puras de Almendras</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/80 shadow-xs">
                            <span className="text-sm">❤️</span>
                            <span>Apto Diabéticos & Keto</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Search and Filters */}
            {recipes.length > 0 && (
                <div className="max-w-5xl mx-auto px-4 mb-10 relative z-20">
                    <div className="glass-card-strong rounded-3xl p-4 md:p-6 shadow-[0_12px_40px_rgba(93,58,41,0.06)] border border-white/80 space-y-4">
                        {/* Search Bar - Dedicated Top Row */}
                        <div className="relative max-w-xl mx-auto w-full">
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                width="18" 
                                height="18" 
                                className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-brand-brown/40 pointer-events-none" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Buscar delicias keto por nombre o ingrediente..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-10 py-3 rounded-2xl border border-brand-brown/12 bg-white/95 outline-none text-brand-brown placeholder-brand-brown/40 font-medium text-sm transition-all focus:border-brand-accent/60 focus:ring-4 focus:ring-brand-accent/15 focus:bg-white shadow-xs"
                            />
                            {searchQuery && (
                                <button 
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-brand-brown/10 text-brand-brown/70 hover:text-brand-brown hover:bg-brand-brown/20 flex items-center justify-center text-xs font-bold transition-colors"
                                    aria-label="Limpiar búsqueda"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Category Pills - Wrapped with 100% visibility of all options */}
                        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setActiveSection(null)}
                                className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 active:scale-95 ${
                                    activeSection === null 
                                        ? 'warm-gradient-brown text-white shadow-md shadow-brand-brown/25 scale-[1.02]' 
                                        : 'bg-white/85 border border-brand-brown/12 text-brand-brown/75 hover:bg-white hover:text-brand-brown hover:border-brand-brown/25 shadow-xs'
                                }`}
                            >
                                <span>Todos</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                    activeSection === null ? 'bg-white/20 text-white' : 'bg-brand-brown/10 text-brand-brown'
                                }`}>
                                    {recipes.length}
                                </span>
                            </button>
                            {allSections.map(sec => {
                                const count = recipes.filter(r => r.catalogSection === sec).length;
                                return (
                                    <button
                                        key={sec}
                                        type="button"
                                        onClick={() => setActiveSection(sec === activeSection ? null : sec)}
                                        className={`px-4 py-2.5 rounded-2xl text-xs md:text-sm font-bold transition-all flex items-center gap-2 active:scale-95 ${
                                            activeSection === sec 
                                                ? 'warm-gradient-brown text-white shadow-md shadow-brand-brown/25 scale-[1.02]' 
                                                : 'bg-white/85 border border-brand-brown/12 text-brand-brown/75 hover:bg-white hover:text-brand-brown hover:border-brand-brown/25 shadow-xs'
                                        }`}
                                    >
                                        <span>{sec}</span>
                                        {count > 0 && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                activeSection === sec ? 'bg-white/20 text-white' : 'bg-brand-brown/10 text-brand-brown'
                                            }`}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Products Grid */}
            <main className="max-w-6xl mx-auto px-4 py-8 relative z-10 min-h-[50vh]">
                {recipes.length === 0 ? (
                    <div className="text-center py-20 glass-card rounded-3xl max-w-md mx-auto p-8">
                        <div className="text-5xl mb-4">🧁</div>
                        <h2 className="text-2xl font-serif font-bold text-brand-brown mb-2">Catálogo en Preparación</h2>
                        <p className="text-brand-brown/65 text-sm">Pronto encontrarás nuestras recetas y especialidades aquí.</p>
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
                                    <div className="text-center py-16 glass-card rounded-3xl max-w-lg mx-auto p-8 animate-fade-in-up">
                                        <div className="text-5xl mb-4">🔍</div>
                                        <h2 className="text-2xl font-serif font-bold text-brand-brown mb-2">No se encontraron productos</h2>
                                        <p className="text-brand-brown/65 text-sm mb-6">Probá buscando con otra palabra o limpiando los filtros seleccionados.</p>
                                        <button 
                                            type="button"
                                            onClick={() => { setSearchQuery(''); setActiveSection(null); }}
                                            className="px-6 py-2.5 warm-gradient-brown text-white font-bold rounded-full transition-all btn-glow shadow-sm text-sm"
                                        >
                                            Ver Todo el Catálogo
                                        </button>
                                    </div>
                                );
                            }

                            const groupedRecipes = new Map<string, Recipe[]>();
                            const unassigned: Recipe[] = [];

                            if (activeSection) {
                                groupedRecipes.set(activeSection, filteredRecipes);
                            } else {
                                allSections.forEach(sec => groupedRecipes.set(sec, []));
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
                                    sectionsToRender.push(['Otras Delicias', unassigned]);
                                }
                            }

                            return (
                                <div className="space-y-16 md:space-y-20">
                                    {sectionsToRender.map(([sectionName, groupRecipes]) => (
                                        <section key={sectionName} aria-label={sectionName}>
                                            {/* Delicate Section Title Header */}
                                            <div className="flex flex-col items-center justify-center mb-10">
                                                <div className="flex items-center gap-4 w-full max-w-xl justify-center px-4">
                                                    <div className="h-px bg-gradient-to-r from-transparent via-brand-accent/50 to-brand-brown/20 flex-1"></div>
                                                    <div className="text-center px-3">
                                                        <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-brand-accent block mb-1">
                                                            ✦ ELABORACIÓN ARTESANAL ✦
                                                        </span>
                                                        <h2 className="text-2xl md:text-3xl lg:text-4xl font-serif font-black text-brand-brown tracking-tight">
                                                            {sectionName}
                                                        </h2>
                                                    </div>
                                                    <div className="h-px bg-gradient-to-l from-transparent via-brand-accent/50 to-brand-brown/20 flex-1"></div>
                                                </div>
                                                <span className="text-xs text-brand-brown/65 font-medium mt-2.5 bg-white/70 px-3.5 py-1 rounded-full border border-brand-brown/10 shadow-xs">
                                                    {groupRecipes.length} {groupRecipes.length === 1 ? 'variedad disponible' : 'variedades disponibles'}
                                                </span>
                                            </div>

                                            {/* Cards Grid */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7 md:gap-8">
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
                                        </section>
                                    ))}
                                </div>
                            );
                        })()}
                    </>
                )}
            </main>

            {/* Footer */}
            <footer className="relative w-full bg-[#3D2215] text-white/80 pt-16 pb-24 md:pb-14 rounded-t-[3rem] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] z-20 border-t border-brand-accent/20">
                <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
                    <div className="flex flex-col items-center md:items-start">
                        {shopLogo && (
                            <img src={shopLogo} alt="Logo" className="w-16 h-16 rounded-full object-cover mb-4 border-2 border-white/20 shadow-md" />
                        )}
                        <h3 className="font-serif text-3xl font-black text-white mb-3 tracking-wide">{shopName || 'Alternativa Keto'}</h3>
                        <p className="text-sm leading-relaxed max-w-sm text-white/75 font-sans">
                            Ofrecemos los mejores productos artesanales pensados para tu bienestar. Elaborados con amor y los mejores ingredientes seleccionados.
                        </p>
                    </div>
                    
                    <div className="flex flex-col items-center md:items-start">
                        <h3 className="font-bold text-white mb-5 uppercase tracking-[0.2em] text-xs">Información & Envíos</h3>
                        <ul className="space-y-3.5 text-sm font-medium text-white/80">
                            <li className="flex items-center gap-2.5">
                                <span className="text-lg">📍</span> 
                                <span><strong>Ubicación:</strong> Berazategui, Buenos Aires</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="text-lg">🏪</span> 
                                <span>Retiro sin cargo en nuestro punto de entrega</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="text-lg">🚗</span> 
                                <span>Envíos vía <strong>Uber</strong> (a cargo del cliente)</span>
                            </li>
                            <li className="flex items-center gap-2.5">
                                <span className="text-lg">🕒</span> 
                                <span>Pedidos con <strong>24hs de anticipación</strong></span>
                            </li>
                        </ul>
                    </div>
                    
                    <div className="flex flex-col items-center md:items-start">
                        <h3 className="font-bold text-white mb-5 uppercase tracking-[0.2em] text-xs">Contacto Directo</h3>
                        <ul className="space-y-3 w-full max-w-xs">
                            <li>
                                <a 
                                    href="https://instagram.com/alternativaketo" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center gap-3 hover:text-white hover:bg-white/20 transition-all bg-white/10 py-3 px-5 rounded-2xl border border-white/15 w-full font-bold text-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                                    <span>@alternativaketo</span>
                                </a>
                            </li>
                            <li>
                                <a 
                                    href={`https://wa.me/${getCleanWhatsappNumber(shopWhatsapp)}?text=${encodeURIComponent('¡Hola! Me gustaría hacer una consulta sobre sus productos.')}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center gap-3 hover:text-white hover:bg-brand-accent transition-all bg-brand-accent/20 py-3 px-5 rounded-2xl border border-brand-accent/40 w-full text-white font-bold text-xs md:text-sm"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    <span>WhatsApp: {formatWhatsappDisplay(shopWhatsapp)}</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                
                <div className="max-w-6xl mx-auto px-6 mt-12 pt-6 border-t border-white/10 text-center flex flex-col items-center justify-center opacity-70">
                    <p className="text-xs tracking-wider">© {new Date().getFullYear()} {shopName || 'Alternativa Keto'}. Todos los derechos reservados.</p>
                </div>
            </footer>

            {/* Mobile bottom floating bar for cart */}
            {cartCount > 0 && !showCart && !showCheckout && (
                <div className="fixed bottom-5 left-4 right-4 z-40 md:hidden animate-fade-in-up">
                    <button
                        type="button"
                        onClick={() => setShowCart(true)}
                        className="w-full py-4 warm-gradient-brown text-white font-bold rounded-2xl shadow-2xl flex items-center justify-between px-6 btn-glow active:scale-98"
                    >
                        <div className="flex items-center gap-2.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                            <span className="text-sm">Ver Carrito ({cartCount})</span>
                        </div>
                        <span className="font-serif font-black text-lg">${cartTotal.toLocaleString()}</span>
                    </button>
                </div>
            )}

            {/* Persistent Floating WhatsApp Button */}
            {!showCheckout && !showCart && (
                <aside 
                    aria-label="Contacto por WhatsApp"
                    className={`fixed z-30 transition-all duration-300 ${cartCount > 0 ? 'bottom-24 md:bottom-8 left-4 md:left-8' : 'bottom-6 md:bottom-8 left-4 md:left-8'}`}
                >
                    <a
                        href={`https://wa.me/${getCleanWhatsappNumber(shopWhatsapp)}?text=${encodeURIComponent('¡Hola! Me gustaría hacer una consulta sobre los productos de Alternativa Keto.')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Contactar por WhatsApp: ${formatWhatsappDisplay(shopWhatsapp)}`}
                        className="flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white px-3.5 py-2 md:px-4 md:py-2.5 rounded-full shadow-[0_6px_20px_rgba(37,211,102,0.3)] hover:scale-105 active:scale-95 transition-all group border border-white/90"
                    >
                        <div className="relative flex items-center justify-center">
                            <svg className="w-4 h-4 md:w-5 md:h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full animate-ping"></span>
                            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-white rounded-full"></span>
                        </div>
                        <div className="hidden sm:flex flex-col text-left leading-tight pr-0.5">
                            <span className="text-[9px] uppercase font-bold tracking-wider text-white/90">WhatsApp</span>
                            <span className="text-xs font-bold tracking-wide text-white">{formatWhatsappDisplay(shopWhatsapp)}</span>
                        </div>
                    </a>
                </aside>
            )}

            {/* Cart Slide-over Drawer */}
            {showCart && (
                <div 
                    className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm animate-fade-in" 
                    onClick={() => setShowCart(false)}
                >
                    <div
                        className="w-full max-w-md bg-white/95 backdrop-blur-2xl h-full shadow-2xl flex flex-col animate-fade-in-up border-l border-white/70"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Cart Header */}
                        <div className="p-5 md:p-6 border-b border-brand-brown/10 flex items-center justify-between bg-white/60">
                            <div>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-brand-accent block">Tu Selección</span>
                                <h2 className="text-2xl font-serif font-black text-brand-brown">Carrito de Compras</h2>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowCart(false)} 
                                className="w-9 h-9 rounded-full bg-brand-brown/10 hover:bg-brand-brown/20 text-brand-brown flex items-center justify-center transition-colors"
                                aria-label="Cerrar carrito"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Cart Items List */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-3 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="text-center py-20 text-brand-brown/50">
                                    <div className="w-16 h-16 rounded-full bg-brand-brown/5 flex items-center justify-center mx-auto mb-3.5 text-3xl">
                                        🛒
                                    </div>
                                    <p className="font-serif font-bold text-lg text-brand-brown">Tu carrito está vacío</p>
                                    <p className="text-xs text-brand-brown/60 mt-1 max-w-xs mx-auto">
                                        Explorá nuestro catálogo y sumá tus delicias favoritas para coordinar tu pedido.
                                    </p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.recipe.id} className="flex items-center gap-3 bg-white/85 backdrop-blur-sm rounded-2xl p-3 border border-brand-brown/8 shadow-xs cart-item-enter">
                                        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-brand-cream/50 border border-brand-brown/10 shadow-inner">
                                            {item.recipe.catalogImages && item.recipe.catalogImages.length > 0 ? (
                                                <img src={item.recipe.catalogImages[0]} alt="" className="w-full h-full object-cover" />
                                            ) : item.recipe.catalogImage ? (
                                                <img src={item.recipe.catalogImage} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full warm-gradient-brown flex items-center justify-center text-xl">🧁</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm text-brand-brown truncate">{item.recipe.name}</h4>
                                            <p className="text-xs text-brand-accent font-semibold">${item.recipe.catalogPrice?.toLocaleString()} c/u</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-brand-brown/5 rounded-xl p-1">
                                            <button 
                                                type="button"
                                                onClick={() => updateQuantity(item.recipe.id, item.quantity - 1)} 
                                                className="w-7 h-7 rounded-lg bg-white text-brand-brown font-bold text-sm shadow-xs hover:bg-brand-brown/10 flex items-center justify-center active:scale-90 transition-all"
                                                aria-label="Restar una unidad"
                                            >−</button>
                                            <span className="w-5 text-center text-xs font-black text-brand-brown">{item.quantity}</span>
                                            <button 
                                                type="button"
                                                onClick={() => updateQuantity(item.recipe.id, item.quantity + 1)} 
                                                className="w-7 h-7 rounded-lg bg-white text-brand-brown font-bold text-sm shadow-xs hover:bg-brand-brown/10 flex items-center justify-center active:scale-90 transition-all"
                                                aria-label="Sumar una unidad"
                                            >+</button>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => removeFromCart(item.recipe.id)} 
                                            className="p-1.5 text-stone-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50" 
                                            title="Eliminar del carrito"
                                        >
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
                            <div className="p-5 md:p-6 border-t border-brand-brown/10 bg-brand-cream/60 space-y-3.5">
                                <div className="flex justify-between items-baseline">
                                    <span className="font-serif font-bold text-lg text-brand-brown">Total Estimado</span>
                                    <span className="text-3xl font-serif font-black text-brand-brown">${cartTotal.toLocaleString()}</span>
                                </div>
                                <div className="text-xs text-brand-brown/80 bg-white/90 rounded-2xl p-3 border border-brand-brown/10 flex items-center gap-2.5 shadow-xs">
                                    <span className="text-lg">🚗</span>
                                    <span>Envíos vía <strong>Uber</strong> (a cargo del cliente) o retiro sin cargo en nuestro local.</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setShowCart(false); setShowCheckout(true); }}
                                    className="w-full py-4 warm-gradient-brown text-white font-bold rounded-2xl btn-glow text-base shadow-lg shadow-brand-brown/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                                >
                                    <span>Continuar con el Pedido</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Checkout Modal */}
            {showCheckout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-lg glass-card-strong rounded-3xl shadow-2xl flex flex-col max-h-[92vh] animate-fade-in-up border border-white/80 overflow-hidden">
                        {/* Header */}
                        <div className="p-5 md:p-6 border-b border-brand-brown/10 flex items-center justify-between bg-white/50">
                            <div>
                                <span className="text-[10px] uppercase font-bold tracking-widest text-brand-accent">Paso Final</span>
                                <h2 className="text-2xl font-serif font-black text-brand-brown">Completar Pedido</h2>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowCheckout(false)} 
                                className="w-9 h-9 rounded-full bg-brand-brown/10 hover:bg-brand-brown/20 text-brand-brown flex items-center justify-center transition-colors"
                                aria-label="Cerrar modal"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Form */}
                        <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4 custom-scrollbar">
                            {/* Order Summary */}
                            <div className="bg-brand-cream/80 rounded-2xl p-4 border border-brand-accent/25 space-y-2.5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-brand-brown uppercase tracking-wider flex items-center gap-1.5">
                                        <span>🛍️</span> Resumen de tu selección
                                    </h3>
                                    <span className="text-xs text-brand-brown/60 font-semibold">{cart.length} {cart.length === 1 ? 'ítem' : 'ítems'}</span>
                                </div>
                                <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                    {cart.map(item => (
                                        <div key={item.recipe.id} className="flex justify-between text-xs text-brand-brown/85 py-0.5">
                                            <span className="font-medium truncate pr-2">• {item.quantity}x {item.recipe.name}</span>
                                            <span className="font-bold flex-shrink-0">${((item.recipe.catalogPrice || 0) * item.quantity).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t border-brand-brown/10 pt-2.5 flex justify-between font-serif font-black text-base text-brand-brown">
                                    <span>Total Estimado</span>
                                    <span className="text-xl text-brand-brown">${cartTotal.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Client info */}
                            <div>
                                <label className="block text-xs font-bold text-brand-brown uppercase tracking-wider mb-1.5">Nombre Completo *</label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={e => setClientName(e.target.value)}
                                    className="w-full p-3.5 rounded-2xl border border-brand-brown/15 focus:ring-2 focus:ring-brand-accent/40 outline-none bg-white font-medium text-brand-brown placeholder-brand-brown/40 text-sm transition-all focus:border-brand-accent shadow-xs"
                                    placeholder="¿A nombre de quién registramos el pedido?"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-brown uppercase tracking-wider mb-1.5">Teléfono de Contacto *</label>
                                <input
                                    type="tel"
                                    value={clientPhone}
                                    onChange={e => setClientPhone(e.target.value)}
                                    className="w-full p-3.5 rounded-2xl border border-brand-brown/15 focus:ring-2 focus:ring-brand-accent/40 outline-none bg-white font-medium text-brand-brown placeholder-brand-brown/40 text-sm transition-all focus:border-brand-accent shadow-xs"
                                    placeholder="Ej. 11 2345-6789 (para coordinar por WhatsApp)"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-brown uppercase tracking-wider mb-1.5">Método de Entrega *</label>
                                <div className="grid grid-cols-2 gap-3 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setDeliveryMethod('pickup')}
                                        className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
                                            deliveryMethod === 'pickup' 
                                                ? 'border-brand-accent bg-brand-accent/15 text-brand-brown font-bold shadow-sm' 
                                                : 'border-brand-brown/10 hover:border-brand-brown/25 text-brand-brown/70 bg-white/80'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <span>🏪</span> Retiro yo
                                        </div>
                                        <span className="text-[11px] font-normal opacity-75">En Berazategui</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDeliveryMethod('delivery')}
                                        className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-0.5 ${
                                            deliveryMethod === 'delivery' 
                                                ? 'border-brand-accent bg-brand-accent/15 text-brand-brown font-bold shadow-sm' 
                                                : 'border-brand-brown/10 hover:border-brand-brown/25 text-brand-brown/70 bg-white/80'
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <span>🚗</span> Quiero envío
                                        </div>
                                        <span className="text-[11px] font-normal opacity-75">Vía Uber</span>
                                    </button>
                                </div>
                                {deliveryMethod === 'pickup' && (
                                    <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3 text-xs text-amber-950 flex items-center gap-2.5 animate-fade-in shadow-xs">
                                        <span className="text-base flex-shrink-0">📍</span>
                                        <span>Punto de retiro en <strong>Berazategui</strong>. Te compartimos la dirección exacta y horario al confirmar por WhatsApp.</span>
                                    </div>
                                )}
                            </div>
                            {deliveryMethod === 'delivery' && (
                                <div className="space-y-3 animate-fade-in">
                                    {/* Leyenda Uber a cargo del cliente */}
                                    <div className="bg-amber-50/95 border-2 border-amber-300/90 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                                        <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center font-black text-lg flex-shrink-0 shadow-xs">
                                            🚗
                                        </div>
                                        <div className="flex-1 text-xs text-stone-800 leading-relaxed">
                                            <p className="font-bold text-amber-950 text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                <span>Aviso sobre el envío</span>
                                                <span className="bg-black text-white text-[9px] uppercase font-black px-1.5 py-0.5 rounded tracking-wider">Uber</span>
                                            </p>
                                            <p className="text-amber-950 font-medium">
                                                El traslado se realiza a través de <strong className="text-black bg-white px-1.5 py-0.5 rounded border border-amber-200">Uber</strong> y el costo queda <strong className="underline decoration-amber-500 underline-offset-2">a cargo del cliente</strong> al momento de la entrega o coordinado tras enviar el pedido.
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-brand-brown uppercase tracking-wider mb-1.5">Dirección exacta de Envío *</label>
                                        <input
                                            type="text"
                                            value={clientAddress}
                                            onChange={e => setClientAddress(e.target.value)}
                                            className="w-full p-3.5 rounded-2xl border border-brand-brown/15 focus:ring-2 focus:ring-brand-accent/40 outline-none bg-white font-medium text-brand-brown placeholder-brand-brown/40 text-sm transition-all shadow-xs"
                                            placeholder="Calle, altura, piso/depto y localidad (para cotizar el Uber)"
                                            required={deliveryMethod === 'delivery'}
                                        />
                                        <p className="text-[11px] text-brand-brown/65 mt-1 font-medium">
                                            📍 Por favor escribí la dirección completa para que podamos calcular el viaje en Uber con exactitud.
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-brand-brown uppercase tracking-wider mb-1.5">Fecha de Entrega *</label>
                                    <input
                                        type="date"
                                        value={deliveryDate}
                                        onChange={e => setDeliveryDate(e.target.value)}
                                        min={minDateAvailable}
                                        className="w-full p-3.5 rounded-2xl border border-brand-brown/15 focus:ring-2 focus:ring-brand-accent/40 outline-none bg-white font-medium text-brand-brown text-sm shadow-xs"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-brand-brown uppercase tracking-wider mb-1.5">Hora <span className="font-normal opacity-60">(opcional)</span></label>
                                    <input
                                        type="time"
                                        value={deliveryTime}
                                        onChange={e => setDeliveryTime(e.target.value)}
                                        className="w-full p-3.5 rounded-2xl border border-brand-brown/15 focus:ring-2 focus:ring-brand-accent/40 outline-none bg-white font-medium text-brand-brown text-sm shadow-xs"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-brand-brown uppercase tracking-wider mb-1.5">Preferencias o notas <span className="font-normal opacity-60">(opcional)</span></label>
                                <textarea
                                    value={clientNotes}
                                    onChange={e => setClientNotes(e.target.value)}
                                    className="w-full p-3.5 rounded-2xl border border-brand-brown/15 focus:ring-2 focus:ring-brand-accent/40 outline-none bg-white resize-none font-medium text-brand-brown text-sm placeholder-brand-brown/40 shadow-xs"
                                    rows={2}
                                    placeholder="Ej. Alguna dedicatoria, sin nueces, horario preferido..."
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="p-5 md:p-6 border-t border-brand-brown/10 bg-white/50 flex gap-3">
                            <button
                                type="button"
                                onClick={() => { setShowCheckout(false); setShowCart(true); }}
                                className="px-5 py-3.5 border border-brand-brown/20 rounded-2xl text-brand-brown font-bold hover:bg-brand-brown/5 transition-colors text-sm"
                            >
                                Volver al Carrito
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmitOrder}
                                disabled={isSubmitting}
                                className="flex-1 py-3.5 warm-gradient-brown text-white font-bold rounded-2xl btn-glow disabled:opacity-50 text-base shadow-lg shadow-brand-brown/20 flex items-center justify-center gap-2 active:scale-[0.98]"
                            >
                                <span>{isSubmitting ? 'Enviando Pedido...' : `Confirmar y Enviar · $${cartTotal.toLocaleString()}`}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CatalogPage;

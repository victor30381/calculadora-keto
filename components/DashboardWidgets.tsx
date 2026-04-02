import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Order } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';



// --- DELIVERY LIST ---
interface DeliveryListProps {
    orders: Order[];
    onEdit?: (order: Order) => void;
    onView?: (order: Order) => void;
}

const DeliveredHistoryModal: React.FC<{
    orders: Order[];
    onClose: () => void;
    onView?: (order: Order) => void;
    onEdit?: (order: Order) => void;
    handleToggleStatus: (order: Order) => void;
    handleDeleteClick: (orderId: string) => void;
    confirmingDeleteId: string | null;
}> = ({ orders, onClose, onView, onEdit, handleToggleStatus, handleDeleteClick, confirmingDeleteId }) => {
    const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all');
    const [customDate, setCustomDate] = useState<string>('');

    const filteredOrders = orders.filter(o => {
        if (filter === 'all') return true;
        
        const d = new Date(o.deliveryDate);
        const today = new Date();
        
        if (filter === 'today') {
            return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }
        
        if (filter === 'week') {
            const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const startOfWeek = new Date(startOfToday);
            startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay() + (startOfToday.getDay() === 0 ? -6 : 1)); // Lunes
            const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return dDate >= startOfWeek;
        }

        if (filter === 'month') {
            return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        }

        if (filter === 'custom' && customDate) {
            const [year, month, day] = customDate.split('-').map(Number);
            return d.getDate() === day && d.getMonth() === month - 1 && d.getFullYear() === year;
        }

        return true;
    });

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="relative w-full max-w-2xl glass-card-strong sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden bg-white/90 max-h-[90vh]">
                <div className="p-5 sm:p-6 border-b border-brand-brown/10 flex justify-between items-center bg-white/50 backdrop-blur-sm z-10 sticky top-0">
                    <h3 className="font-serif font-bold text-xl text-brand-brown flex items-center gap-2">
                        <span>📦</span> Historial de Entregados
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-brand-brown/40 hover:text-brand-brown hover:bg-brand-brown/10 rounded-full transition-colors border border-transparent hover:border-brand-brown/10 shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-4 sm:p-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                        {['all', 'today', 'week', 'month'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${filter === f ? 'warm-gradient-brown text-white shadow-md' : 'bg-white/80 text-brand-brown/60 hover:bg-white border border-brand-brown/10'}`}
                            >
                                {f === 'all' ? 'Todos' : f === 'today' ? 'Hoy' : f === 'week' ? 'Esta Semana' : 'Este Mes'}
                            </button>
                        ))}
                        <div className="relative flex items-center">
                            <input 
                                type="date"
                                value={customDate}
                                onChange={(e) => {
                                    setCustomDate(e.target.value);
                                    if(e.target.value) setFilter('custom');
                                }}
                                className={`px-3 py-1.5 rounded-full text-sm font-bold border outline-none bg-white/80 transition-all ${filter === 'custom' ? 'border-brand-accent text-brand-brown ring-1 ring-brand-accent/30 shadow-sm' : 'border-brand-brown/10 text-brand-brown/60 hover:border-brand-brown/30'}`}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        {filteredOrders.length > 0 ? (
                            filteredOrders.map((order) => (
                                <div
                                    key={order.id}
                                    onClick={() => onView && onView(order)}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-100 last:border-0 group cursor-pointer transition-all duration-200 rounded-xl p-3 opacity-80 hover:opacity-100 hover:bg-white/60 bg-white/30"
                                >
                                    <div className="text-sm text-brand-brown mb-2 sm:mb-0">
                                        <span className="font-bold block text-brand-brown/50 text-xs">
                                            {new Date(order.deliveryDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        </span>
                                        <span className="font-medium text-brand-brown/80">
                                            {order.items.map(item => item.name).join(', ')}
                                        </span>
                                        <span className="text-stone-500 block text-sm font-bold mt-0.5">({order.clientName})</span>
                                    </div>

                                    <div className="flex gap-1.5 shrink-0 transition-opacity duration-200">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onView && onView(order); }}
                                            className="p-1.5 text-xs bg-white/80 backdrop-blur border border-brand-brown/10 rounded-lg hover:bg-blue-50 text-brand-brown shadow-sm transition-colors"
                                            title="Ver Pedido"
                                        >
                                            👁️
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(order); }}
                                            className="p-1.5 text-xs bg-white/80 backdrop-blur border border-brand-brown/10 rounded-lg hover:bg-brand-accent/10 text-brand-brown shadow-sm transition-colors"
                                            title="Marcar Pendiente"
                                        >
                                            ↩️
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onEdit && onEdit(order); }}
                                            className="p-1.5 text-xs bg-white/80 backdrop-blur border border-brand-brown/10 rounded-lg hover:bg-brand-accent/10 text-brand-brown shadow-sm transition-colors"
                                            title="Editar"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteClick(order.id); }}
                                            className={`p-1.5 text-xs backdrop-blur border rounded-lg shadow-sm transition-all ${confirmingDeleteId === order.id
                                                ? 'border-red-400 bg-red-500 text-white hover:bg-red-600'
                                                : 'bg-white/80 border-red-200/50 hover:bg-red-50 text-red-500'
                                                }`}
                                            title="Eliminar"
                                        >
                                            {confirmingDeleteId === order.id ? '¿Borrar?' : '🗑️'}
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-brand-brown/30 italic text-center py-8 text-sm">No hay pedidos entregados en este periodo</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};

export const DeliveryList: React.FC<DeliveryListProps> = ({ orders, onEdit, onView }) => {
    // Filter for upcoming orders (pending and future/today)
    const upcomingOrders = orders
        .filter(o => o.status !== 'completed' && new Date(o.deliveryDate) >= new Date(new Date().setHours(0, 0, 0, 0)))
        .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
    // Limit removed to show all upcoming orders

    // Filter for delivered orders
    const deliveredOrders = orders
        .filter(o => o.status === 'completed')
        .sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime()); // Most recent first

    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    const handleToggleStatus = async (order: Order) => {
        try {
            const newStatus = order.status === 'completed' ? 'pending' : 'completed';
            await updateDoc(doc(db, 'orders', order.id), { status: newStatus });
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Error al actualizar estado");
        }
    };

    const handleDeleteClick = (orderId: string) => {
        if (confirmingDeleteId === orderId) {
            performDelete(orderId);
        } else {
            setConfirmingDeleteId(orderId);
            setTimeout(() => setConfirmingDeleteId(null), 3000);
        }
    };

    const performDelete = async (orderId: string) => {
        try {
            await deleteDoc(doc(db, 'orders', orderId));
            setConfirmingDeleteId(null);
        } catch (error: any) {
            console.error("Error deleting order:", error);
            alert(`Error al eliminar pedido: ${error.message}`);
        }
    };

    return (
        <div className="w-full lg:w-80 flex flex-col gap-6 stagger-children">
            <div className="glass-card rounded-2xl p-6 card-hover-lift animate-fade-in-up">
                <h3 className="text-lg font-serif font-bold text-brand-brown mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-brand-accent animate-pulse"></span>
                    Próximas Entregas
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                    {upcomingOrders.length > 0 ? (
                        upcomingOrders.map((order) => (
                            <div
                                key={order.id}
                                onClick={() => (!order.clientId ? (onEdit && onEdit(order)) : (onView && onView(order)))}
                                className="flex flex-col pb-3 border-b border-brand-brown/5 last:border-0 group cursor-pointer hover:bg-white/60 transition-all duration-200 rounded-xl p-2.5"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-sm text-brand-brown">
                                        <span className="font-bold block text-brand-accent text-xs tracking-wide">
                                            {new Date(order.deliveryDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                            {order.deliveryTime && <span className="ml-1 text-brand-brown/60">· {order.deliveryTime}hs</span>}
                                        </span>
                                        <span className="font-medium text-brand-brown/80">{order.items.map(item => item.name).join(', ')}</span>
                                        <span className="text-brand-brown font-bold block text-sm mt-0.5">({order.clientName})</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {(order as any).source === 'catalog' && (
                                            <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-green-100/80 text-green-700 border border-green-200/50">
                                                🛒 Catálogo
                                            </div>
                                        )}
                                        <div className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100/80 text-amber-700 border border-amber-200/50 backdrop-blur-sm">
                                            Pendiente
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-1.5 justify-end transition-opacity duration-200">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onView && onView(order); }}
                                        className="p-1.5 text-xs bg-white/80 backdrop-blur border border-brand-brown/10 rounded-lg hover:bg-blue-50 text-brand-brown shadow-sm transition-colors"
                                        title="Ver Pedido"
                                    >
                                        👁️
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(order); }}
                                        className="p-1.5 text-xs bg-white/80 backdrop-blur border border-brand-brown/10 rounded-lg hover:bg-green-50 text-brand-brown shadow-sm transition-colors"
                                        title="Marcar Entregado"
                                    >
                                        ✅
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit && onEdit(order); }}
                                        className="p-1.5 text-xs bg-white/80 backdrop-blur border border-brand-brown/10 rounded-lg hover:bg-brand-accent/10 text-brand-brown shadow-sm transition-colors"
                                        title="Editar"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(order.id); }}
                                        className={`p-1.5 text-xs backdrop-blur border rounded-lg shadow-sm transition-all ${confirmingDeleteId === order.id
                                            ? 'border-red-400 bg-red-500 text-white hover:bg-red-600'
                                            : 'bg-white/80 border-red-200/50 hover:bg-red-50 text-red-500'
                                            }`}
                                        title="Eliminar"
                                    >
                                        {confirmingDeleteId === order.id ? '¿Borrar?' : '🗑️'}
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-brand-brown/30 italic text-center py-6 text-sm">No hay entregas pendientes</p>
                    )}
                </div>
            </div>

            {deliveredOrders.length > 0 && (
                <div className="glass-card rounded-2xl p-6 opacity-70 hover:opacity-100 transition-opacity duration-300 animate-fade-in-up">
                    <h3 className="text-base font-serif font-bold text-stone-400 mb-4 flex items-center gap-2">
                        <span>📦</span> Entregados Recientemente
                    </h3>
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {deliveredOrders.slice(0, 5).map((order) => (
                            <div
                                key={order.id}
                                onClick={() => onView && onView(order)}
                                className="flex flex-col pb-3 border-b border-stone-100 last:border-0 group cursor-pointer transition-all duration-200 rounded-xl p-2 opacity-60 hover:opacity-100 hover:bg-white/40"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="text-sm text-brand-brown">
                                        <span className="font-bold block text-brand-brown/40 line-through text-xs">
                                            {new Date(order.deliveryDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                        <span className="line-through text-brand-brown/50">
                                            {order.items.map(item => item.name).join(', ')}
                                        </span>
                                        <span className="text-stone-400 block text-sm font-bold mt-0.5">({order.clientName})</span>
                                    </div>
                                </div>

                                <div className="flex gap-1.5 justify-end mt-2 transition-opacity duration-200">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onView && onView(order); }}
                                        className="p-1.5 text-xs bg-white/80 backdrop-blur border border-brand-brown/10 rounded-lg hover:bg-blue-50 text-brand-brown shadow-sm transition-colors"
                                        title="Ver Pedido"
                                    >
                                        👁️
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(order); }}
                                        className="p-1.5 text-xs bg-white/80 backdrop-blur border border-brand-brown/10 rounded-lg hover:bg-brand-accent/10 text-brand-brown shadow-sm transition-colors"
                                        title="Marcar Pendiente"
                                    >
                                        ↩️
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit && onEdit(order); }}
                                        className="p-1.5 text-xs bg-white/80 backdrop-blur border border-brand-brown/10 rounded-lg hover:bg-brand-accent/10 text-brand-brown shadow-sm transition-colors"
                                        title="Editar"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(order.id); }}
                                        className={`p-1.5 text-xs backdrop-blur border rounded-lg shadow-sm transition-all ${confirmingDeleteId === order.id
                                            ? 'border-red-400 bg-red-500 text-white hover:bg-red-600'
                                            : 'bg-white/80 border-red-200/50 hover:bg-red-50 text-red-500'
                                            }`}
                                        title="Eliminar"
                                    >
                                        {confirmingDeleteId === order.id ? '¿Borrar?' : '🗑️'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {deliveredOrders.length > 5 && (
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => setShowHistoryModal(true)}
                                className="text-xs font-bold text-brand-brown hover:text-brand-accent transition-colors underline underline-offset-2 opacity-80 hover:opacity-100"
                            >
                                Ver historial completo ({deliveredOrders.length})
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {showHistoryModal && (
                <DeliveredHistoryModal
                    orders={deliveredOrders}
                    onClose={() => setShowHistoryModal(false)}
                    onView={onView}
                    onEdit={onEdit}
                    handleToggleStatus={handleToggleStatus}
                    handleDeleteClick={handleDeleteClick}
                    confirmingDeleteId={confirmingDeleteId}
                />
            )}
        </div>
    );
};

interface StatCardProps {
    title: string;
    value: string | number;
    subtext?: string;
    isAlert?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtext, isAlert }) => (
    <div className="glass-card rounded-2xl overflow-hidden card-hover-lift animate-fade-in-up">
        <div className="warm-gradient-brown text-white px-5 py-3 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent/80 animate-pulse"></span>
            <span className="text-sm font-bold tracking-wide">{title}</span>
        </div>
        <div className="p-5 flex-1 flex flex-col justify-center items-center text-center">
            <div className={`text-3xl font-bold font-serif tracking-tight ${isAlert ? 'text-red-500' : 'text-brand-brown'}`}>
                {value}
            </div>
            {subtext && <div className="text-sm font-bold text-brand-accent mt-2 bg-brand-accent/8 px-3 py-1 rounded-full">{subtext}</div>}
        </div>
    </div>
);

// --- CALENDAR WIDGET ---
// --- CALENDAR WIDGET ---
interface CalendarWidgetProps {
    orders: Order[];
    onNewOrder?: (date: Date) => void;
    onViewOrder?: (order: Order) => void;
    onEditOrder?: (order: Order) => void;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ orders, onNewOrder, onViewOrder, onEditOrder }) => {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateDetails, setSelectedDateDetails] = useState<{ date: Date, orders: Order[] } | null>(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    const handleDeleteClick = async (e: React.MouseEvent, orderId: string) => {
        e.stopPropagation();
        if (confirmingDeleteId === orderId) {
            try {
                await deleteDoc(doc(db, 'orders', orderId));
                setConfirmingDeleteId(null);
                setSelectedDateDetails(prev => prev ? {
                    ...prev,
                    orders: prev.orders.filter(o => o.id !== orderId)
                } : null);
            } catch (error) {
                console.error("Error deleting order:", error);
                alert("Error al eliminar pedido");
            }
        } else {
            setConfirmingDeleteId(orderId);
            setTimeout(() => setConfirmingDeleteId(null), 3000);
        }
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const dates = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const startDayOffset = firstDayOfMonth;

    const getOrdersForDate = (day: number) => {
        return orders.filter(o => {
            const d = new Date(o.deliveryDate);
            return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
        });
    };

    const handleDateClick = (day: number) => {
        const date = new Date(year, month, day);
        const dayOrders = getOrdersForDate(day);
        setSelectedDateDetails({ date, orders: dayOrders });
    };

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    return (
        <div className="glass-card rounded-2xl p-6 flex-1 relative card-hover-lift animate-fade-in-up">

            {/* Date Details Modal/Popover */}
            {selectedDateDetails && (
                <div className="absolute inset-0 z-10 bg-black/20 backdrop-blur-[2px] rounded-2xl flex items-center justify-center p-4 animate-fade-in">
                    <div className="glass-card-strong rounded-2xl shadow-2xl p-5 w-full max-w-[280px] space-y-3" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center border-b border-brand-brown/10 pb-3">
                            <h4 className="font-serif font-bold text-brand-brown text-lg">
                                {selectedDateDetails.date.getDate()} de {monthNames[selectedDateDetails.date.getMonth()]}
                            </h4>
                            <button
                                onClick={() => setSelectedDateDetails(null)}
                                className="text-stone-400 hover:text-brand-brown w-7 h-7 rounded-full hover:bg-brand-brown/5 flex items-center justify-center transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {selectedDateDetails.orders.length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                <p className="text-[10px] font-bold text-brand-brown/50 uppercase tracking-widest">Pedidos:</p>
                                {selectedDateDetails.orders.map(order => (
                                    <div key={order.id} className="flex gap-2 items-center">
                                        <button
                                            onClick={() => {
                                                if (!order.clientId) {
                                                    onEditOrder && onEditOrder(order);
                                                } else {
                                                    onViewOrder && onViewOrder(order);
                                                }
                                                setSelectedDateDetails(null);
                                            }}
                                            className="flex-1 text-left p-2.5 rounded-xl bg-white/50 hover:bg-white text-sm text-brand-brown transition-all flex items-center justify-between group border border-transparent hover:border-brand-accent/20"
                                        >
                                            <div>
                                                <span className="font-medium truncate block">{order.clientName}</span>
                                                {order.deliveryTime && <span className="text-[11px] text-brand-accent font-bold">{order.deliveryTime}hs</span>}
                                            </div>
                                            <span className="text-xs opacity-0 group-hover:opacity-100 text-brand-accent transition-opacity">Abrir</span>
                                        </button>
                                        <div className="flex gap-1 shrink-0 ml-1" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onViewOrder && onViewOrder(order); setSelectedDateDetails(null); }}
                                                className="w-7 h-7 text-xs rounded-lg bg-white/50 hover:bg-brand-accent/10 border border-brand-brown/10 text-brand-brown transition-all shadow-sm flex items-center justify-center"
                                                title="Ver"
                                            >
                                                👁️
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onEditOrder && onEditOrder(order); setSelectedDateDetails(null); }}
                                                className="w-7 h-7 text-xs rounded-lg bg-white/50 hover:bg-brand-accent/10 border border-brand-brown/10 text-brand-brown transition-all shadow-sm flex items-center justify-center"
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteClick(e, order.id)}
                                                className={`h-7 px-1.5 text-xs rounded-lg border shadow-sm transition-all flex items-center justify-center ${confirmingDeleteId === order.id ? 'bg-red-500 text-white border-red-500 font-bold px-2' : 'w-7 bg-white/50 border-red-200/50 hover:bg-red-50 text-red-500'}`}
                                                title="Eliminar"
                                            >
                                                {confirmingDeleteId === order.id ? '¿Borrar?' : '🗑️'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-stone-400 italic py-3 text-center">Sin pedidos agendados</p>
                        )}

                        <button
                            onClick={() => {
                                onNewOrder && onNewOrder(selectedDateDetails.date);
                                setSelectedDateDetails(null);
                            }}
                            className="w-full py-2.5 warm-gradient-brown text-white text-sm font-bold rounded-xl btn-glow shadow-md flex items-center justify-center gap-1 transition-all"
                        >
                            <span>+</span> Nuevo Pedido
                        </button>
                    </div>
                    {/* Background click to close */}
                    <div className="absolute inset-0 -z-10" onClick={() => setSelectedDateDetails(null)}></div>
                </div>
            )}

            <div className="flex justify-between items-center mb-5">
                <button
                    onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                    className="text-brand-brown hover:bg-white/70 p-2 rounded-xl transition-colors w-9 h-9 flex items-center justify-center"
                >
                    &lt;
                </button>
                <h3 className="text-lg font-serif font-bold text-brand-brown capitalize tracking-tight">
                    {monthNames[month]} {year}
                </h3>
                <button
                    onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                    className="text-brand-brown hover:bg-white/70 p-2 rounded-xl transition-colors w-9 h-9 flex items-center justify-center"
                >
                    &gt;
                </button>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-xs mb-2">
                {['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'].map(d => <div key={d} className="font-bold text-brand-brown/40 uppercase tracking-wider py-1">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
                {Array(startDayOffset).fill(null).map((_, i) => <div key={`empty-${i}`} />)}

                {dates.map(date => {
                    const dayOrders = getOrdersForDate(date);
                    const hasDelivery = dayOrders.length > 0;
                    const isToday = date === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                    return (
                        <div
                            key={date}
                            onClick={() => handleDateClick(date)}
                            className={`
                                aspect-square flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all duration-200 relative
                                ${isToday ? 'today-neon-glow' : 'hover:bg-white/70 hover:shadow-sm'}
                                ${hasDelivery ? 'bg-white/60 font-bold border border-brand-accent/20 shadow-sm' : ''}
                            `}
                            title={hasDelivery ? `${dayOrders.length} entregas` : 'Crear Pedido'}
                        >
                            <span className={`text-sm ${hasDelivery || isToday ? 'font-bold text-brand-brown' : 'text-stone-400'}`}>{date}</span>
                            {hasDelivery && (
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-accent mt-0.5 animate-pulse"></span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};



// --- PRODUCTION SUMMARY ---
interface ProductionSummaryProps {
    orders: Order[];
}

export const ProductionSummary: React.FC<ProductionSummaryProps> = ({ orders }) => {
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [crossedOutItems, setCrossedOutItems] = useState<Set<string>>(new Set());

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [year, month, day] = e.target.value.split('-').map(Number);
        setSelectedDate(new Date(year, month - 1, day));
        setCrossedOutItems(new Set()); // Reset crosses when date changes
    };

    const toggleCrossOut = (itemName: string) => {
        setCrossedOutItems(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemName)) {
                newSet.delete(itemName);
            } else {
                newSet.add(itemName);
            }
            return newSet;
        });
    };

    const formatDateForInput = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    // Filter orders by selected date
    const filteredOrders = orders.filter(o => {
        const d = new Date(o.deliveryDate);
        return d.getDate() === selectedDate.getDate() &&
               d.getMonth() === selectedDate.getMonth() &&
               d.getFullYear() === selectedDate.getFullYear();
    });

    // Group items and collect client details
    const summary = filteredOrders.reduce((acc, order) => {
        order.items.forEach(item => {
            if (!acc[item.name]) {
                acc[item.name] = { total: 0, clients: [] };
            }
            acc[item.name].total += item.quantity;
            acc[item.name].clients.push({
                name: order.clientName,
                qty: item.quantity
            });
        });
        return acc;
    }, {} as Record<string, { total: number, clients: { name: string, qty: number }[] }>);

    const items: [string, { total: number, clients: { name: string, qty: number }[] }][] = Object.entries(summary);

    return (
        <div className="glass-card rounded-2xl p-4 sm:p-6 w-full relative animate-fade-in-up">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-lg sm:text-xl font-serif font-bold text-brand-brown flex items-center gap-2">
                    <span className="text-xl sm:text-2xl">👩‍🍳</span> Resumen de Producción
                </h3>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-sm font-bold text-brand-brown/60 whitespace-nowrap">Fecha:</label>
                    <input 
                        type="date"
                        className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-white/60 focus:outline-none input-premium text-brand-brown bg-white/50 shadow-sm text-sm font-medium"
                        value={formatDateForInput(selectedDate)}
                        onChange={handleDateChange}
                    />
                </div>
            </div>

            {items.length === 0 ? (
                <p className="text-center text-brand-brown/30 italic py-8 text-sm">No hay producción programada para esta fecha.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 stagger-children">
                    {items.map(([name, data]) => {
                        const isCrossed = crossedOutItems.has(name);
                        return (
                        <div key={name} className="relative group animate-fade-in-up">
                            <div
                                className={`w-full bg-white/60 backdrop-blur p-3 sm:p-4 rounded-xl border flex flex-col justify-center items-stretch shadow-sm hover:shadow-md transition-all duration-200 ${expandedItem === name ? 'border-brand-accent ring-2 ring-brand-accent/15' : 'border-white/50'} ${isCrossed ? 'opacity-40 bg-stone-50/50' : ''}`}
                            >
                                <div className="flex justify-between items-center w-full">
                                    <div 
                                        className="flex-1 cursor-pointer flex items-center pr-2 py-1"
                                        onClick={() => toggleCrossOut(name)}
                                        title="Click para tachar/destachar producto"
                                    >
                                        <span className={`text-brand-brown font-bold text-sm leading-tight text-left transition-all ${isCrossed ? 'line-through text-stone-400' : ''}`}>
                                            {name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`warm-gradient-brown text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm whitespace-nowrap transition-colors ${isCrossed ? '!bg-stone-400' : ''}`} style={isCrossed ? {background: '#a8a29e'} : {}}>
                                            {data.total}
                                        </span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setExpandedItem(expandedItem === name ? null : name); }}
                                            className="text-brand-brown p-1.5 hover:bg-brand-accent/10 rounded-lg transition-colors flex items-center justify-center"
                                            title="Ver detalle para clientes"
                                        >
                                            <svg className={`w-4 h-4 transition-transform duration-200 ${expandedItem === name ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
    
                            {/* Dropdown for client details (UPWARDS) */}
                            {expandedItem === name && (
                                <div className="absolute bottom-full left-0 right-0 z-50 mb-2 glass-card-strong rounded-xl shadow-2xl p-3 animate-fade-in">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase mb-2 tracking-widest">¿Para quién es?</p>
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {data.clients.map((c, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-xs pb-1.5 border-b border-stone-50 last:border-0 last:pb-0">
                                                <span className="text-brand-brown/80 font-medium">{c.name}</span>
                                                <span className="font-bold text-brand-accent bg-brand-accent/8 px-2 py-0.5 rounded-full text-[11px]">x{c.qty}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setExpandedItem(null); }}
                                        className="w-full mt-3 text-[10px] text-stone-400 hover:text-brand-brown font-bold transition-colors"
                                    >
                                        Cerrar detalle
                                    </button>
                                </div>
                            )}
                        </div>
                    )})}
                </div>
            )}

            {/* Background click to close overlay */}
            {expandedItem && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setExpandedItem(null)}
                ></div>
            )}
        </div>
    );
};

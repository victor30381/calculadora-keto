import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { Order, Recipe, Ingredient, ProductionLog } from '../types';
import { StatCard } from './DashboardWidgets';
import jsPDF from 'jspdf';

interface FinancesViewProps {
    userId: string;
}

interface DailyStat {
    date: string;
    ingresos: number;
    costos: number;
    ganancias: number;
    rawDate: Date;
    orders: Order[];
}

const FinancesView: React.FC<FinancesViewProps> = ({ userId }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    
    // Filtros de periodo
    const [selectedDate, setSelectedDate] = useState<string>(''); // YYYY-MM-DD
    const [selectedWeek, setSelectedWeek] = useState<string>(''); // YYYY-Www
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM

    useEffect(() => {
        if (!userId) return;

        const qOrders = query(collection(db, 'orders'), where('userId', '==', userId));
        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    deliveryDate: data.deliveryDate instanceof Timestamp ? data.deliveryDate.toDate() : new Date(data.deliveryDate),
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)
                } as Order;
            });
            setOrders(fetchedOrders);
            setLoading(false);
        });

        const qRecipes = query(collection(db, 'recipes'), where('userId', '==', userId));
        const unsubRecipes = onSnapshot(qRecipes, (snapshot) => {
            setRecipes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe)));
        });

        const qIngredients = query(collection(db, 'ingredients'), where('userId', '==', userId));
        const unsubIng = onSnapshot(qIngredients, (snapshot) => {
            setIngredients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient)));
        });

        const qLogs = query(collection(db, 'production_logs'), where('userId', '==', userId));
        const unsubLogs = onSnapshot(qLogs, (snapshot) => {
            setProductionLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionLog)));
        });

        return () => {
            unsubOrders();
            unsubRecipes();
            unsubIng();
            unsubLogs();
        };
    }, [userId]);

    const calculateOrderCost = (order: Order) => {
        return order.items.reduce((sum, item: any) => {
            if (item.cost != null) {
                return sum + item.cost;
            }
            const recipe = recipes.find(r => r.id === item.recipeId || r.id === item.id);
            if (recipe) {
                if (recipe.isPromo) {
                    // Costo total de promo * cantidad
                    return sum + (recipe.totalCost * item.quantity);
                } else {
                    // Costo gramo * cantidad en gramos * cant de items (unidades o bandejas)
                    return sum + (item.amount * recipe.costPerGram * item.quantity);
                }
            }
            return sum + (item.price * item.quantity / 3);
        }, 0);
    };

    const getStartOfWeek = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when Sunday
        return new Date(d.setDate(diff));
    };

    const getIsoWeekString = (date: Date) => {
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    };

    const isFiltered = (timeframe === 'daily' && selectedDate) || 
                       (timeframe === 'weekly' && selectedWeek) || 
                       (timeframe === 'monthly' && selectedMonth);

    const filteredOrders = orders.filter(order => {
        if (timeframe === 'daily' && selectedDate) {
            const mMonth = String(order.deliveryDate.getMonth() + 1).padStart(2, '0');
            const mDay = String(order.deliveryDate.getDate()).padStart(2, '0');
            const orderDateStr = `${order.deliveryDate.getFullYear()}-${mMonth}-${mDay}`;
            return orderDateStr === selectedDate;
        }
        if (timeframe === 'weekly' && selectedWeek) {
            return getIsoWeekString(order.deliveryDate) === selectedWeek;
        }
        if (timeframe === 'monthly' && selectedMonth) {
            const mMonth = String(order.deliveryDate.getMonth() + 1).padStart(2, '0');
            const orderMonthStr = `${order.deliveryDate.getFullYear()}-${mMonth}`;
            return orderMonthStr === selectedMonth;
        }
        return true;
    });

    const groupingMode = isFiltered ? 'daily' : timeframe;

    // Group data by selected timeframe or grouping mode
    const aggregatedDataMap = filteredOrders.reduce((acc, order) => {
        let dateKey = "";
        let rawDate = order.deliveryDate;

        if (groupingMode === 'daily') {
            dateKey = order.deliveryDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        } else if (groupingMode === 'weekly') {
            const startOfWeek = getStartOfWeek(order.deliveryDate);
            dateKey = `Sem. ${startOfWeek.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`;
            rawDate = startOfWeek;
        } else if (groupingMode === 'monthly') {
            dateKey = order.deliveryDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            rawDate = new Date(order.deliveryDate.getFullYear(), order.deliveryDate.getMonth(), 1);
        }

        const gross = order.total || 0;
        const cost = calculateOrderCost(order);
        const profit = gross - cost;

        if (!acc[dateKey]) {
            acc[dateKey] = { date: dateKey, ingresos: 0, costos: 0, ganancias: 0, rawDate, orders: [] };
        }
        acc[dateKey].ingresos += gross;
        acc[dateKey].costos += Math.round(cost);
        acc[dateKey].ganancias += Math.round(profit);
        acc[dateKey].orders.push(order);
        return acc;
    }, {} as Record<string, DailyStat>);

    const sortedData: DailyStat[] = (Object.values(aggregatedDataMap) as DailyStat[]).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    // Totals
    const totalGross = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const totalCost = filteredOrders.reduce((sum, o) => sum + calculateOrderCost(o), 0);
    const totalProfit = Math.round(totalGross - totalCost);

    // New Calculations for Cards
    const stockValue = ingredients.reduce((sum, ing) => {
        if ((ing.currentStock || 0) > 0) {
            return sum + ((ing.currentStock || 0) * ing.pricePerUnit);
        }
        return sum;
    }, 0);

    const productionValue = productionLogs.reduce((sum, log) => {
        const recipe = recipes.find(r => r.id === log.recipeId);
        if (recipe && recipe.costPerGram) {
            return sum + (log.quantityProduced * recipe.costPerGram);
        }
        return sum;
    }, 0);

    const generateReportPDF = () => {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        let currentY = 20;
        const marginLeft = 15;
        const pageWidth = doc.internal.pageSize.getWidth();

        // Colors
        const primaryColor = '#2C1810';
        const accentColor = '#D4A373';

        // Title
        doc.setFontSize(22);
        doc.setTextColor(primaryColor);
        doc.setFont("helvetica", "bold");
        doc.text("Reporte de Ventas", pageWidth / 2, currentY, { align: "center" });
        currentY += 8;
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        const periodName = timeframe === 'daily' ? 'Diaria' : timeframe === 'weekly' ? 'Semanal' : 'Mensual';
        doc.text(`Vista: ${periodName} - Generado el ${new Date().toLocaleDateString('es-AR')}`, pageWidth / 2, currentY, { align: "center" });
        currentY += 15;

        // Loop through sortedData
        sortedData.forEach((stat) => {
            // Check page limit
            if (currentY > 260) {
                doc.addPage();
                currentY = 20;
            }

            // Period Header
            doc.setFillColor(accentColor);
            doc.rect(marginLeft, currentY - 5, pageWidth - marginLeft * 2, 8, 'F');
            doc.setTextColor('#ffffff');
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text(`${stat.date.toUpperCase()}`, marginLeft + 5, currentY + 0.5);
            
            // Period Summary Right Aligned
            const summaryText = `Total: $${stat.ingresos.toLocaleString()} | Costo: $${stat.costos.toLocaleString()} | Ganancia: $${stat.ganancias.toLocaleString()}`;
            doc.setFont("helvetica", "bold");
            doc.text(summaryText, pageWidth - marginLeft - 5, currentY + 0.5, { align: "right" });
            
            currentY += 8;
            doc.setTextColor(primaryColor);

            // Print Orders headers
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            
            doc.text("Día/Hora", marginLeft + 2, currentY);
            doc.text("Detalle (Productos)", marginLeft + 35, currentY);
            doc.text("Costo", marginLeft + 120, currentY);
            doc.text("Venta", marginLeft + 145, currentY);
            doc.text("Ganancia", marginLeft + 170, currentY);
            
            currentY += 2;
            doc.setLineWidth(0.5);
            doc.setDrawColor(200, 200, 200);
            doc.line(marginLeft, currentY, pageWidth - marginLeft, currentY);
            currentY += 5;

            // Sort orders chronologically within period
            const periodOrders = [...stat.orders].sort((a,b) => a.deliveryDate.getTime() - b.deliveryDate.getTime());

            periodOrders.forEach(order => {
                if (currentY > 270) {
                    doc.addPage();
                    currentY = 20;
                    
                    // Reprint headers
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(primaryColor);
                    doc.text("Día/Hora", marginLeft + 2, currentY);
                    doc.text("Detalle (Productos)", marginLeft + 35, currentY);
                    doc.text("Costo", marginLeft + 120, currentY);
                    doc.text("Venta ($)", marginLeft + 145, currentY);
                    doc.text("Ganancia", marginLeft + 170, currentY);
                    currentY += 2;
                    doc.line(marginLeft, currentY, pageWidth - marginLeft, currentY);
                    currentY += 5;
                }

                doc.setFont("helvetica", "normal");
                
                // DateTime
                const dateStr = order.deliveryDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + order.deliveryDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute:'2-digit' });
                doc.text(dateStr, marginLeft + 2, currentY);

                // Items summary
                const itemsStr = order.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
                const itemsLines = doc.splitTextToSize(itemsStr, 80);
                doc.text(itemsLines, marginLeft + 35, currentY);
                
                const c_cost = Math.round(calculateOrderCost(order));
                const c_price = Math.round(order.total);
                const c_prof = c_price - c_cost;

                doc.text(`$${c_cost.toLocaleString('es-AR')}`, marginLeft + 120, currentY);
                doc.text(`$${c_price.toLocaleString('es-AR')}`, marginLeft + 145, currentY);
                Object.assign(doc, { setTextColor: doc.setTextColor }); 
                doc.text(`$${c_prof.toLocaleString('es-AR')}`, marginLeft + 170, currentY);

                currentY += (itemsLines.length * 4) + 2;
            });
            currentY += 5; // space between periods
        });

        // Descargar directamente
        doc.save(`reporte_financiero_${timeframe}.pdf`);
    };

    if (loading) return <div className="p-8 text-center text-brand-brown font-serif italic">Cargando datos financieros...</div>;

    const maxVal = Math.max(...sortedData.map(d => d.ingresos), 1);

    return (
        <div className="flex flex-col gap-8 pb-10 animate-fade-in">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-brand-brown mb-2 tracking-tight">Finanzas de la Empresa</h2>
                    <p className="text-stone-500 font-medium">Análisis detallado de ingresos, costos y rentabilidad.</p>
                </div>

                {/* Timeframe Selector and Filters */}
                <div className="flex glass-card p-1.5 rounded-2xl self-start md:self-auto items-center gap-1 flex-wrap md:flex-nowrap">
                    <div className="flex bg-white/40 rounded-xl p-1">
                        {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => {
                                    setTimeframe(t);
                                    setSelectedDate('');
                                    setSelectedWeek('');
                                    setSelectedMonth('');
                                }}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 uppercase tracking-wider
                                    ${timeframe === t
                                        ? 'warm-gradient-brown text-white shadow-md'
                                        : 'text-brand-brown/50 hover:text-brand-brown hover:bg-white/50'}`}
                            >
                                {t === 'daily' ? 'Día' : t === 'weekly' ? 'Semana' : 'Mes'}
                            </button>
                        ))}
                    </div>

                    {/* Date Pickers */}
                    <div className="flex bg-white/40 rounded-xl p-1 items-center gap-2 h-full">
                        {timeframe === 'daily' && (
                            <input 
                                type="date" 
                                value={selectedDate} 
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-2 py-1.5 rounded-lg bg-white text-sm text-brand-brown border border-brand-brown/10 focus:outline-none focus:ring-1 focus:ring-brand-accent/50 max-w-[140px]" 
                                title="Seleccionar día específico"
                            />
                        )}
                        {timeframe === 'weekly' && (
                            <input 
                                type="week" 
                                value={selectedWeek} 
                                onChange={(e) => setSelectedWeek(e.target.value)}
                                className="px-2 py-1.5 rounded-lg bg-white text-sm text-brand-brown border border-brand-brown/10 focus:outline-none focus:ring-1 focus:ring-brand-accent/50 max-w-[150px]" 
                                title="Seleccionar semana específica"
                            />
                        )}
                        {timeframe === 'monthly' && (
                            <input 
                                type="month" 
                                value={selectedMonth} 
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="px-2 py-1.5 rounded-lg bg-white text-sm text-brand-brown border border-brand-brown/10 focus:outline-none focus:ring-1 focus:ring-brand-accent/50 max-w-[140px]" 
                                title="Seleccionar mes específico"
                            />
                        )}
                        {isFiltered && (
                            <button 
                                onClick={() => { setSelectedDate(''); setSelectedWeek(''); setSelectedMonth(''); }}
                                className="text-xs text-brand-brown/60 bg-white hover:text-red-500 hover:bg-red-50 border border-brand-brown/10 font-bold px-2 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                                title="Mostrar todo (deshacer filtro)"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={generateReportPDF}
                        title="Exportar Detalle PDF (A4)"
                        className="p-2 ml-1 md:ml-2 bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-white rounded-lg transition-colors flex items-center justify-center font-bold"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </button>
                </div>
            </header>

            {/* Global Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
                <StatCard title="Ingresos Totales" value={`$${totalGross.toLocaleString()}`} />
                <StatCard title="Costos (Ventas)" value={`$${Math.round(totalCost).toLocaleString()}`} />
                <StatCard title="Ganancia Neta" value={`$${totalProfit.toLocaleString()}`} subtext="Rentabilidad total" />
            </div>

            {/* Inventory & Production Stats */}
            <h3 className="text-xl font-serif font-bold text-brand-brown mt-4 mb-2">Indicadores Operativos</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-2xl flex flex-col items-center text-center card-hover-lift animate-fade-in-up">
                    <span className="text-4xl mb-2">📦</span>
                    <h4 className="text-stone-500 font-bold uppercase tracking-wider text-xs mb-1">Valor Stock Insumos</h4>
                    <p className="text-2xl font-serif font-bold text-brand-brown">
                        ${stockValue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-stone-400 mt-2">Dinero en estantería (MP)</p>
                </div>

                <div className="glass-card p-6 rounded-2xl flex flex-col items-center text-center card-hover-lift animate-fade-in-up">
                    <span className="text-4xl mb-2">👩‍🍳</span>
                    <h4 className="text-stone-500 font-bold uppercase tracking-wider text-xs mb-1">Producción Registrada</h4>
                    <p className="text-2xl font-serif font-bold text-brand-brown">
                        ${productionValue.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                    </p>
                    <p className="text-xs text-stone-400 mt-2">Valor costo elaborado total</p>
                </div>

                <div className="glass-card p-6 rounded-2xl flex flex-col items-center text-center card-hover-lift animate-fade-in-up">
                    <span className="text-4xl mb-2">📈</span>
                    <h4 className="text-stone-500 font-bold uppercase tracking-wider text-xs mb-1">Margen Promedio</h4>
                    <p className="text-2xl font-serif font-bold text-brand-accent">
                        {totalGross > 0 ? ((totalProfit / totalGross) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-xs text-stone-400 mt-2">Sobre ventas totales</p>
                </div>
            </div>

            {/* Visualización Simple */}
            {filteredOrders.length === 0 && isFiltered ? (
                <div className="glass-card rounded-2xl p-6 lg:p-8 text-center text-brand-brown/40 font-serif italic">
                    No hay ventas registradas para el periodo seleccionado.
                </div>
            ) : (
                <div className="glass-card rounded-2xl p-6 lg:p-8">
                    <h3 className="text-xl font-serif font-bold text-brand-brown mb-6 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <span className="text-2xl">📊</span>
                            {isFiltered ? 'Resumen del Periodo' : 'Tendencia de Ingresos'}
                        </span>
                        <span className="text-xs uppercase tracking-widest text-[#D4A373] bg-[#D4A373]/10 px-3 py-1 rounded-full border border-[#D4A373]/20">
                            {groupingMode === 'daily' ? 'Vista Diaria' : groupingMode === 'weekly' ? 'Vista Semanal' : 'Vista Mensual'}
                        </span>
                    </h3>
                    <div className="space-y-4">
                        {sortedData.slice(groupingMode === 'daily' ? -15 : groupingMode === 'weekly' ? -8 : -12).map(day => (
                            <div key={day.date} className="flex flex-col gap-1">
                                <div className="flex justify-between text-sm font-bold text-brand-brown">
                                    <span className="capitalize">{day.date}</span>
                                    <span>${day.ingresos.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-white/60 rounded-full h-3.5 border border-white/40 overflow-hidden backdrop-blur-sm">
                                    <div
                                        className="warm-gradient-accent h-full rounded-full transition-all duration-700 ease-out shadow-sm"
                                        style={{ width: `${(day.ingresos / maxVal) * 100}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                        <p className="text-xs text-stone-400 italic text-center mt-4 uppercase tracking-tighter">
                            Mostrando histórico por {groupingMode === 'daily' ? 'día' : groupingMode === 'weekly' ? 'semana' : 'mes'} {isFiltered ? '(Filtrado)' : ''}
                        </p>
                    </div>
                </div>
            )}

            {/* Detailed Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="warm-gradient-brown px-6 py-4 flex justify-between items-center">
                    <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2">
                        <span>🗓️</span> Desglose {timeframe === 'daily' ? 'Diario' : timeframe === 'weekly' ? 'Semanal' : 'Mensual'}
                    </h3>
                    <span className="text-white/50 text-xs font-bold uppercase tracking-widest">
                        {sortedData.length} registros
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/40 border-b border-brand-brown/5 uppercase text-xs font-bold tracking-widest text-brand-brown/50">
                                <th className="px-6 py-4">Periodo</th>
                                <th className="px-6 py-4">Ingresos</th>
                                <th className="px-6 py-4">Costos Reales</th>
                                <th className="px-6 py-4 text-right">Ganancia</th>
                            </tr>
                        </thead>
                        <tbody className="text-base font-medium">
                            {sortedData.slice().reverse().map((day: DailyStat) => (
                                <tr key={day.date} className="border-b border-brand-brown/5 table-row-premium">
                                    <td className="px-6 py-4 font-bold text-brand-brown capitalize">{day.date}</td>
                                    <td className="px-6 py-4 text-stone-600">${day.ingresos.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-red-400 font-medium">-${day.costos.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-brand-accent">
                                        +${day.ganancias.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FinancesView;

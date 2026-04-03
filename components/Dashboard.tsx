import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { StatCard, CalendarWidget, DeliveryList, ProductionSummary } from './DashboardWidgets';
import { Order, Recipe } from '../types';

interface DashboardProps {
    userId: string;
    onEditOrder?: (order: Order) => void;
    onViewOrder?: (order: Order) => void;
    onNewOrderWithDate?: (date: Date) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ userId, onEditOrder, onViewOrder, onNewOrderWithDate }) => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);

    useEffect(() => {
        if (!userId) return;

        // Fetch Orders
        const qOrders = query(collection(db, 'orders'), where('userId', '==', userId));
        const unsubOrders = onSnapshot(qOrders, (snapshot) => {
            const fetchedOrders = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Handle Firestore Timestamps
                    deliveryDate: data.deliveryDate instanceof Timestamp ? data.deliveryDate.toDate() : new Date(data.deliveryDate),
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)
                } as Order;
            });
            setOrders(fetchedOrders);
        });

        // Fetch Recipes (for cost calculation)
        const qRecipes = query(collection(db, 'recipes'), where('userId', '==', userId));
        const unsubRecipes = onSnapshot(qRecipes, (snapshot) => {
            setRecipes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe)));
        });

        return () => {
            unsubOrders();
            unsubRecipes();
        };
    }, [userId]);

    // Helper: Calculate Material Cost for an Order
    const calculateOrderCost = (order: Order) => {
        return order.items.reduce((sum, item: any) => {
            if (item.cost != null) {
                return sum + item.cost;
            }
            const recipe = recipes.find(r => r.id === item.recipeId || r.id === item.id);
            if (recipe) {
                if (recipe.isPromo) {
                    return sum + (recipe.totalCost * item.quantity);
                } else {
                    return sum + (item.amount * recipe.costPerGram * item.quantity);
                }
            }
            // Fallback for items not linked to a recipe (estimate 1/3 of price)
            return sum + (item.price * item.quantity / 3);
        }, 0);
    };

    // Calculate Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // TODAY'S STATS
    const todayOrdersList = orders.filter(o => {
        const d = new Date(o.deliveryDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === today.getTime();
    });

    const ordersTodayCount = todayOrdersList.length;
    const dailyGross = todayOrdersList.reduce((sum, o) => sum + (o.total || 0), 0);
    const dailyCost = todayOrdersList.reduce((sum, o) => sum + calculateOrderCost(o), 0);
    const dailyProfit = Math.round(dailyGross - dailyCost);

    // MONTHLY STATS
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthlyOrdersList = orders.filter(o => {
        const d = new Date(o.deliveryDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });

    const monthlyStats = monthlyOrdersList.reduce((acc, o) => {
        const orderValue = o.total || 0;
        const orderCost = calculateOrderCost(o);

        return {
            gross: acc.gross + orderValue,
            cost: acc.cost + orderCost
        };
    }, { gross: 0, cost: 0 });

    const monthlyProfit = Math.round(monthlyStats.gross - monthlyStats.cost);

    return (
        <div className="flex flex-col gap-8 animate-fade-in">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
                <StatCard title="Pedidos Hoy:" value={ordersTodayCount.toString()} />
                <StatCard
                    title="Ingresos Hoy:"
                    value={`$${dailyGross.toLocaleString()}`}
                    subtext={`Ganancia: $${dailyProfit.toLocaleString()}`}
                />
                <StatCard
                    title="Ingresos Mes:"
                    value={`$${monthlyStats.gross.toLocaleString()}`}
                    subtext={`Ganancia: $${monthlyProfit.toLocaleString()}`}
                />
            </div>

            {/* Main Content Row */}
            <div className="flex flex-col lg:flex-row gap-6">
                <CalendarWidget orders={orders} onNewOrder={onNewOrderWithDate} onViewOrder={onViewOrder} onEditOrder={onEditOrder} />
                <DeliveryList orders={orders} onEdit={onEditOrder} onView={onViewOrder} />
            </div>

            {/* Production Summary Row */}
            <ProductionSummary orders={orders} />
        </div>
    );
};

export default Dashboard;

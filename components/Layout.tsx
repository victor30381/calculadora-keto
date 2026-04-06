import React, { useState } from 'react';
import { User } from 'firebase/auth';
import Sidebar from './Sidebar';
import Header from './Header';

interface LayoutProps {
    children: React.ReactNode;
    user: User | null;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onLogout: () => void;
    onOpenCalculator: () => void;
    onOpenOrders: () => void;
    onOpenStock: () => void;
    onOpenClients: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, user, activeTab, setActiveTab, onLogout, onOpenCalculator, onOpenOrders, onOpenStock, onOpenClients }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const getTitle = () => {
        switch (activeTab) {
            case 'dashboard': return 'Dashboard';
            case 'calculator': return 'Calculadora Maestra';
            case 'orders': return 'Gestión de Pedidos';
            case 'shipments': return 'Envíos';
            case 'stock': return 'Control de Stock';
            case 'profile': return 'Perfil';
            default: return 'Dashboard';
        }
    };

    return (
        <div className="flex h-screen bg-brand-beige overflow-hidden">
            <Sidebar
                isOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onOpenCalculator={onOpenCalculator}
                onOpenOrders={onOpenOrders}
                onOpenStock={onOpenStock}
                onOpenClients={onOpenClients}
                user={user}
                onLogout={onLogout}
            />

            <div className="flex-1 flex flex-col h-full overflow-hidden w-full relative">
                <Header
                    user={user}
                    title={getTitle()}
                    onLogout={onLogout}
                    toggleSidebar={toggleSidebar}
                />

                <main className="flex-1 overflow-y-auto w-full p-4 md:p-8 warm-gradient-bg">
                    <div className="max-w-7xl mx-auto h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;

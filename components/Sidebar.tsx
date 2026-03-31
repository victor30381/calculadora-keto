import React from 'react';
import logoAK from '../assets/logo-ak.jpg';
import { User } from 'firebase/auth';
import { useTheme } from './ThemeContext';

interface SidebarProps {
    isOpen: boolean;
    toggleSidebar: () => void;
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onOpenCalculator: () => void;
    onOpenOrders: () => void;
    onOpenStock: () => void;
    onOpenClients: () => void;
    user: User | null;
    onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, activeTab, setActiveTab, onOpenCalculator, onOpenOrders, onOpenStock, onOpenClients, user, onLogout }) => {
    const { profileName, logoUrl } = useTheme();

    const navItems = [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
            onClick: () => { setActiveTab('dashboard'); if (window.innerWidth < 768) toggleSidebar(); },
            isActive: activeTab === 'dashboard',
        },
        {
            id: 'calculator',
            label: 'Calculadora Maestra',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />,
            onClick: () => { onOpenCalculator(); if (window.innerWidth < 768) toggleSidebar(); },
            isActive: false,
        },
        {
            id: 'orders',
            label: 'Gestión de Pedidos',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
            onClick: () => { onOpenOrders(); if (window.innerWidth < 768) toggleSidebar(); },
            isActive: false,
        },
        {
            id: 'clientes',
            label: 'Clientes',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
            onClick: () => { onOpenClients(); if (window.innerWidth < 768) toggleSidebar(); },
            isActive: false,
        },
        {
            id: 'stock',
            label: 'Control de Stock',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
            onClick: () => { onOpenStock(); if (window.innerWidth < 768) toggleSidebar(); },
            isActive: false,
        },
        {
            id: 'finances',
            label: 'Finanzas',
            icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
            onClick: () => { setActiveTab('finances'); if (window.innerWidth < 768) toggleSidebar(); },
            isActive: activeTab === 'finances',
        },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden transition-opacity"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar Container */}
            <aside className={`
                fixed top-0 left-0 h-full w-72 z-50 transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                md:translate-x-0 md:static
                bg-gradient-to-b from-brand-beige via-brand-beige to-[#EDE5DB]
                border-r border-brand-brown/8
                shadow-[4px_0_24px_rgba(93,58,41,0.04)]
            `}>
                <div className="p-6 flex flex-col h-full">
                    {/* Logo Area */}
                    <div className="flex flex-col items-center mb-6">
                        <div className="w-28 h-28 rounded-full overflow-hidden border-[3px] border-white shadow-lg mb-4 bg-white ring-4 ring-brand-accent/15 transition-shadow hover:shadow-xl hover:ring-brand-accent/25" style={{animation: 'pulseGlow 4s ease-in-out infinite'}}>
                            <img src={logoUrl || logoAK} alt="Logo" className="w-full h-full object-cover" />
                        </div>

                        {/* User Profile Section */}
                        <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2 text-brand-brown mb-1">
                                <div className="h-5 w-5 rounded-full warm-gradient-accent flex items-center justify-center">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <span className="font-bold text-base">Hola, {profileName || user?.displayName?.split(' ')[0] || 'Anto'}</span>
                            </div>
                            <button
                                onClick={onLogout}
                                className="text-xs text-brand-brown/50 hover:text-brand-brown font-medium transition-colors duration-200"
                            >
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>

                    <div className="decorative-line w-full mb-4 opacity-50"></div>

                    {/* Navigation Links */}
                    <nav className="flex-1 space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={item.onClick}
                                className={`w-full text-left p-3.5 rounded-2xl transition-all duration-300 flex items-center gap-3.5 group
                                    ${item.isActive
                                        ? 'warm-gradient-brown text-white shadow-lg shadow-brand-brown/15 font-bold'
                                        : 'text-brand-brown hover:bg-white/70 hover:shadow-sm border border-transparent hover:border-brand-brown/5'
                                    }`}
                            >
                                <div className={`p-2 rounded-xl transition-all duration-300 ${item.isActive ? 'bg-white/20' : 'bg-brand-brown/5 group-hover:bg-brand-accent/10 group-hover:scale-110'}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        {item.icon}
                                    </svg>
                                </div>
                                <span className="font-serif tracking-wide text-[15px]">{item.label}</span>
                            </button>
                        ))}

                        {/* Divider before profile */}
                        <div className="pt-1 mt-1">
                            <div className="decorative-line w-full opacity-30"></div>
                        </div>

                        <button
                            onClick={() => { setActiveTab('profile'); if (window.innerWidth < 768) toggleSidebar(); }}
                            className={`w-full text-left p-3.5 rounded-2xl transition-all duration-300 flex items-center gap-3.5 group
                                ${activeTab === 'profile'
                                    ? 'warm-gradient-brown text-white shadow-lg shadow-brand-brown/15 font-bold'
                                    : 'text-brand-brown hover:bg-white/70 hover:shadow-sm border border-transparent hover:border-brand-brown/5'
                                }`}
                        >
                             <div className={`p-2 rounded-xl transition-all duration-300 ${activeTab === 'profile' ? 'bg-white/20' : 'bg-brand-brown/5 group-hover:bg-brand-accent/10 group-hover:scale-110'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <span className="font-serif tracking-wide text-[15px]">Mi Perfil</span>
                        </button>

                        {/* Catalog Manager Link */}
                        <button
                            onClick={() => { setActiveTab('catalogManager'); if (window.innerWidth < 768) toggleSidebar(); }}
                            className={`w-full text-left p-3.5 rounded-2xl transition-all duration-300 flex items-center gap-3.5 group
                                ${activeTab === 'catalogManager'
                                    ? 'warm-gradient-brown text-white shadow-lg shadow-brand-brown/15 font-bold'
                                    : 'text-brand-brown hover:bg-green-50 border border-transparent hover:border-green-200'
                                }`}
                        >
                            <div className={`p-2 rounded-xl transition-all duration-300 ${activeTab === 'catalogManager' ? 'bg-white/20' : 'bg-green-100 text-green-700 group-hover:scale-110'}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                            </div>
                            <div>
                                <span className={`font-serif tracking-wide text-[15px] block ${activeTab === 'catalogManager' ? '' : 'text-green-800'}`}>Mi Catálogo</span>
                                <span className={`text-[10px] ${activeTab === 'catalogManager' ? 'text-white/70' : 'text-green-700/60'}`}>Gestionar y compartir</span>
                            </div>
                        </button>
                    </nav>

                    <div className="text-center text-[10px] text-brand-brown/30 font-medium mt-4 tracking-wider uppercase">
                        &copy; 2025 AlternativaKeto
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;

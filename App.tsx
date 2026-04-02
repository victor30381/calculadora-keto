import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import FinancesView from './components/FinancesView';
import CalculatorModal from './components/CalculatorModal';
import OrdersModal from './components/OrdersModal';
import StockModal from './components/StockModal';
import ClientsModal from './components/ClientsModal';
import { ThemeProvider } from './components/ThemeContext';
import ProfileView from './components/ProfileView';
import CatalogPage from './components/CatalogPage';
import CatalogManager from './components/CatalogManager';
function App() {
  // Check if this is a catalog route
  const [catalogUserId, setCatalogUserId] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isOrdersModalOpen, setIsOrdersModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isClientsModalOpen, setIsClientsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [selectedDateForNewOrder, setSelectedDateForNewOrder] = useState<Date | null>(null);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      const isAdmin = hash === '#/admin' || hash === '/admin' || hash === '#admin';
      const match = hash.match(/^\/catalogo\/(.+)$/) || hash.match(/^#\/catalogo\/(.+)$/);
      
      if (isAdmin) {
        setCatalogUserId(null); // Permite el inicio de sesión y uso de la herramienta
      } else if (match) {
        setCatalogUserId(match[1]); // URLs de catálogo anteriores
      } else {
        // Redirigir el dominio sin extensión al catálogo del usuario por defecto
        setCatalogUserId('RysiSSYHT7QFcxhmdbkvDLpUqWG2');
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const toggleCalculator = () => setIsCalculatorOpen(!isCalculatorOpen);
  const toggleStockModal = () => setIsStockModalOpen(!isStockModalOpen);
  const toggleClientsModal = () => setIsClientsModalOpen(!isClientsModalOpen);
  const toggleOrdersModal = () => {
    setIsOrdersModalOpen(!isOrdersModalOpen);
    if (isOrdersModalOpen) {
      setEditingOrder(null);
      setSelectedDateForNewOrder(null);
    }
  }

  const handleEditOrder = (order: any) => {
    setEditingOrder(order);
    setIsReadOnly(false);
    setIsOrdersModalOpen(true);
  };

  const handleViewOrder = (order: any) => {
    setEditingOrder(order);
    setIsReadOnly(true);
    setIsOrdersModalOpen(true);
  };

  const handleNewOrderWithDate = (date: Date) => {
    setSelectedDateForNewOrder(date);
    setEditingOrder(null);
    setIsReadOnly(false);
    setIsOrdersModalOpen(true);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error en autenticación');
    }
  };

  const handleLogout = () => signOut(auth);

  // If catalog route, render public catalog
  if (catalogUserId) {
    return <CatalogPage userId={catalogUserId} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center warm-gradient-bg">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-12 h-12 rounded-full border-4 border-brand-accent/30 border-t-brand-accent animate-spin"></div>
          <span className="text-brand-brown font-serif text-lg font-medium">Cargando...</span>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 warm-gradient-bg relative overflow-hidden">
        {/* Floating Decorative Orbs */}
        <div className="floating-orb absolute top-[10%] left-[15%] w-64 h-64 bg-brand-accent/20" style={{animationDelay: '0s'}}></div>
        <div className="floating-orb absolute bottom-[15%] right-[10%] w-80 h-80 bg-brand-accent/15" style={{animationDelay: '-3s'}}></div>
        <div className="floating-orb absolute top-[60%] left-[60%] w-48 h-48 bg-brand-brown/10" style={{animationDelay: '-5s'}}></div>

        <div className="w-full max-w-md glass-card-strong rounded-3xl p-8 md:p-10 relative z-10 animate-fade-in-up">
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-gradient-warm mb-3 tracking-tight">{localStorage.getItem('savedCompanyName') || 'Alternativa Keto'}</h1>
            <p className="text-stone-500 font-medium text-sm tracking-wide">Gestiona tu comercio con estilo.</p>
            <div className="decorative-line w-20 mx-auto mt-4"></div>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-brand-brown mb-2 tracking-wide">Email</label>
              <input
                type="email"
                required
                className="w-full p-4 rounded-xl border border-white/60 focus:outline-none focus:border-brand-accent/40 input-premium text-brand-brown bg-white/50 placeholder-stone-400 transition-all font-medium"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-brand-brown mb-2 tracking-wide">Contraseña</label>
              <input
                type="password"
                required
                className="w-full p-4 rounded-xl border border-white/60 focus:outline-none focus:border-brand-accent/40 input-premium text-brand-brown bg-white/50 placeholder-stone-400 transition-all font-medium"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {authError && <p className="text-red-600 text-center text-sm bg-red-50/80 backdrop-blur p-3 rounded-xl border border-red-100">{authError}</p>}

            <button type="submit" className="w-full warm-gradient-brown text-white py-4 rounded-xl font-bold font-serif text-lg btn-glow shadow-lg shadow-brand-brown/20 transition-all duration-300">
              {isRegistering ? 'Crear Cuenta' : 'Ingresar al Dashboard'}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-brand-brown/10">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-brand-accent hover:text-brand-brown text-sm font-bold transition-colors duration-200"
            >
              {isRegistering ? '¿Ya tienes cuenta? Ingresa aquí' : '¿Nuevo usuario? Regístrate gratis'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <ThemeProvider userId={user.uid}>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={() => signOut(auth)}
        onOpenCalculator={toggleCalculator}
        onOpenOrders={toggleOrdersModal}
        onOpenStock={toggleStockModal}
        onOpenClients={toggleClientsModal}
      >
        {activeTab === 'dashboard' && <Dashboard userId={user?.uid || ''} onEditOrder={handleEditOrder} onViewOrder={handleViewOrder} onNewOrderWithDate={handleNewOrderWithDate} />}
        {activeTab === 'finances' && <FinancesView userId={user?.uid || ''} />}
        {activeTab === 'profile' && <ProfileView user={user} />}
        {activeTab === 'catalogManager' && <CatalogManager userId={user.uid} user={user} />}
        {/* Helper logic to keep other tabs valid if needed, though mostly using modals now */}
      </Layout>

      {/* Modals */}
      <CalculatorModal
        isOpen={isCalculatorOpen}
        onClose={() => setIsCalculatorOpen(false)}
        userId={user.uid}
      />

      <OrdersModal
        isOpen={isOrdersModalOpen}
        onClose={() => {
          setIsOrdersModalOpen(false);
          setEditingOrder(null);
          setIsReadOnly(false);
        }}
        userId={user.uid}
        initialOrder={editingOrder}
        isReadOnly={isReadOnly}
        initialDate={selectedDateForNewOrder}
      />

      <StockModal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        userId={user.uid}
      />

      <ClientsModal
        isOpen={isClientsModalOpen}
        onClose={() => setIsClientsModalOpen(false)}
        userId={user.uid}
      />
    </ThemeProvider>
  );
}

export default App;
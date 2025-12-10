import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import Ingredients from './components/Ingredients';
import Recipes from './components/Recipes';
import Calculator from './components/Calculator';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'inventory' | 'recipes' | 'calc'>('calc');

  // Auth State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-rose-50 text-rose-400">Cargando...</div>;
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-rose-50">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-rose-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-rose-500 mb-2">Calculadora Keto 🍰</h1>
            <p className="text-slate-500">Gestiona tus costos de pastelería fácil.</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Email</label>
              <input
                type="email"
                required
                className="w-full p-3 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-black bg-gray-50 placeholder-gray-400"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Contraseña</label>
              <input
                type="password"
                required
                className="w-full p-3 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-black bg-gray-50 placeholder-gray-400"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {authError && <p className="text-red-500 text-center text-sm">{authError}</p>}

            <button type="submit" className="w-full bg-rose-500 text-white py-3 rounded-xl font-bold shadow-md hover:bg-rose-600 transition">
              {isRegistering ? 'Registrarse' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-rose-400 hover:text-rose-600 text-sm font-medium underline"
            >
              {isRegistering ? '¿Ya tienes cuenta? Ingresa' : '¿Nuevo usuario? Regístrate'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <div className="min-h-screen bg-rose-50 pb-24 md:pb-0 md:pt-20">
      {/* Header Mobile (Sticky Top) */}
      <div className="md:hidden sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-rose-100 p-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-rose-500">Calculadora Keto 🍰</h1>
        <button onClick={handleLogout} className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full">Salir</button>
      </div>

      {/* Header Desktop */}
      <div className="hidden md:flex fixed top-0 w-full z-20 bg-white border-b border-rose-100 px-8 py-4 justify-between items-center shadow-sm">
        <div className="flex items-center gap-8">
          <h1 className="text-2xl font-bold text-rose-500">Calculadora Keto 🍰</h1>
          <nav className="flex gap-4">
            <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-lg transition ${activeTab === 'inventory' ? 'bg-rose-100 text-rose-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Inventario</button>
            <button onClick={() => setActiveTab('recipes')} className={`px-4 py-2 rounded-lg transition ${activeTab === 'recipes' ? 'bg-rose-100 text-rose-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Recetas</button>
            <button onClick={() => setActiveTab('calc')} className={`px-4 py-2 rounded-lg transition ${activeTab === 'calc' ? 'bg-rose-100 text-rose-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Calculadora</button>
          </nav>
        </div>
        <button onClick={handleLogout} className="text-sm text-slate-500 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50">Cerrar Sesión</button>
      </div>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto p-4 md:p-8">
        {activeTab === 'inventory' && <Ingredients userId={user.uid} />}
        {activeTab === 'recipes' && <Recipes userId={user.uid} />}
        {activeTab === 'calc' && <Calculator userId={user.uid} />}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 w-full bg-white border-t border-rose-100 flex justify-around p-3 pb-safe z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'inventory' ? 'text-rose-500' : 'text-slate-400'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span className="text-xs font-medium">Insumos</span>
        </button>

        <button
          onClick={() => setActiveTab('recipes')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'recipes' ? 'text-rose-500' : 'text-slate-400'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span className="text-xs font-medium">Recetas</span>
        </button>

        <button
          onClick={() => setActiveTab('calc')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'calc' ? 'text-rose-500' : 'text-slate-400'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-medium">Ventas</span>
        </button>
      </div>
    </div>
  );
}

export default App;
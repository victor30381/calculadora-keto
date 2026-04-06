import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Client } from '../types';

interface ClientsViewProps {
    userId: string;
    onBack: () => void;
}

const ClientsView: React.FC<ClientsViewProps> = ({ userId, onBack }) => {
    const [clients, setClients] = useState<Client[]>([]);
    const [activeTab, setActiveTab] = useState<'form' | 'list'>('form');

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [debouncedAddress, setDebouncedAddress] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedAddress(address);
        }, 800);
        return () => clearTimeout(handler);
    }, [address]);

    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, 'clients'), where('userId', '==', userId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            data.sort((a, b) => a.name.localeCompare(b.name));
            setClients(data);
        });
        return () => unsubscribe();
    }, [userId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setIsLoading(true);
        try {
            if (editingId) {
                await updateDoc(doc(db, 'clients', editingId), { name, phone, address });
                setEditingId(null);
                alert("Cliente actualizado correctamente");
            } else {
                await addDoc(collection(db, 'clients'), { userId, name, phone, address, createdAt: new Date() });
                alert("Cliente guardado correctamente");
            }
            setName(''); setPhone(''); setAddress('');
        } catch (error) {
            console.error("Error:", error);
            alert("Error al guardar: " + (error as any).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (client: Client) => {
        setName(client.name);
        setPhone(client.phone);
        setAddress(client.address);
        setEditingId(client.id);
        setActiveTab('form'); // Switch to form tab
    };

    const handleDelete = async (id: string) => {
        console.log("Attempting to delete client:", id);
        if (!id) {
            alert("Error: ID de cliente no válido");
            return;
        }

        // Removed confirm for debugging purposes to ensure function executes
        try {
            await deleteDoc(doc(db, 'clients', id));
            console.log("Client deleted successfully");
            // alert("Cliente eliminado correctamente"); // Optional: remove if too annoying, but good for feedback
        } catch (error) {
            console.error("Error deleting client:", error);
            alert("Error al eliminar: " + (error as any).message);
        }
    };

    // ...



    return (
        <div className="flex flex-col h-full min-h-[500px]">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 relative">
                <button
                    onClick={onBack}
                    className="p-2 rounded-full hover:bg-brand-brown/10 text-brand-brown transition-colors absolute left-0"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                </button>
                <div className="w-full text-center">
                    <h2 className="text-3xl font-serif font-bold text-brand-brown">Gestión de Clientes</h2>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex p-1 bg-brand-brown/10 rounded-xl mb-6">
                <button
                    onClick={() => setActiveTab('form')}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${activeTab === 'form'
                        ? 'bg-white text-brand-brown shadow-sm'
                        : 'text-brand-brown/60 hover:text-brand-brown'
                        }`}
                >
                    {editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
                </button>
                <button
                    onClick={() => setActiveTab('list')}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${activeTab === 'list'
                        ? 'bg-white text-brand-brown shadow-sm'
                        : 'text-brand-brown/60 hover:text-brand-brown'
                        }`}
                >
                    Lista de Clientes ({clients.length})
                </button>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {activeTab === 'form' ? (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-brown/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-brand-brown mb-1.5">Nombre Completo</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-brand-cream/30"
                                    placeholder="Ej: Ana Gómez"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-brand-brown mb-1.5">Teléfono</label>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-brand-cream/30"
                                    placeholder="+54 9 11..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-brand-brown mb-1.5">Dirección</label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none bg-brand-cream/30"
                                    placeholder="Calle 123, Ciudad"
                                />
                                {debouncedAddress.length > 5 && (
                                    <div className="mt-3 rounded-xl overflow-hidden border border-brand-brown/20 h-48 w-full shadow-inner relative animate-fade-in">
                                        <iframe
                                            width="100%"
                                            height="100%"
                                            style={{ border: 0 }}
                                            loading="lazy"
                                            allowFullScreen
                                            src={`https://maps.google.com/maps?q=${encodeURIComponent(debouncedAddress + (debouncedAddress.toLowerCase().includes('argentina') ? '' : ', Argentina'))}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                        ></iframe>
                                    </div>
                                )}
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 bg-brand-brown text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-[#5D4229] transition-all disabled:opacity-50"
                                >
                                    {isLoading ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar Cliente'}
                                </button>
                                {editingId && (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingId(null); setName(''); setPhone(''); setAddress(''); }}
                                        className="px-6 py-3.5 rounded-xl border-2 border-brand-brown/20 text-brand-brown font-bold hover:bg-brand-brown/5"
                                    >
                                        Cancelar
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 pb-4">
                        {clients.length === 0 ? (
                            <div className="text-center py-12 opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-brand-brown" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <p className="font-serif text-lg text-brand-brown">No hay clientes aún</p>
                                <button onClick={() => setActiveTab('form')} className="text-brand-accent underline mt-2">Agregar el primero</button>
                            </div>
                        ) : (
                            clients.map(client => (
                                <div key={client.id} className="bg-white p-4 rounded-xl shadow-sm border border-brand-brown/10 hover:border-brand-brown/30 transition-all group flex justify-between items-center">
                                    <div className="flex-1 min-w-0 mr-4">
                                        <h4 className="font-bold text-brand-brown truncate">{client.name}</h4>
                                        <div className="text-sm text-brand-brown/60 space-y-0.5 mt-1">
                                            {client.phone && <p className="flex items-center gap-1.5 truncate"><span className="opacity-50">📞</span> {client.phone}</p>}
                                            {client.address && <p className="flex items-center gap-1.5 truncate"><span className="opacity-50">📍</span> {client.address}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleEdit(client)}
                                            className="p-2 text-brand-brown/40 hover:text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
                                            title="Editar"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                alert("Click detectado en borrar: " + client.id); // DEBUG
                                                handleDelete(client.id);
                                            }}
                                            className="p-2 text-brand-brown/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Eliminar"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientsView;

import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { Ingredient, Unit, formatQuantity } from '../types';

interface Props {
  userId: string;
}

const Ingredients: React.FC<Props> = ({ userId }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>(Unit.KG);
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'ingredients'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient));
        // Sort alphabetically
        data.sort((a, b) => a.name.localeCompare(b.name));
        setIngredients(data);
      },
      (err) => {
        console.error("Firestore Error:", err);
        setError("Error de permisos: No se pueden cargar los ingredientes. Verifica las reglas de seguridad en Firebase Console.");
      }
    );
    return () => unsubscribe();
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedName = name.trim();
    if (!trimmedName || !price) return;

    // Check duplicates (exclude current editing ID)
    const exists = ingredients.some(
      ing => ing.name.toLowerCase() === trimmedName.toLowerCase() && ing.id !== editingId
    );

    if (exists) {
      setError('Ya existe un ingrediente con ese nombre.');
      return;
    }

    try {
      const qty = parseFloat(quantity) || 1;
      const totalPkgPrice = parseFloat(price);

      const ingredientData = {
        name: trimmedName,
        unit,
        quantity: qty,
        pricePerUnit: totalPkgPrice / qty,
        userId
      };

      if (editingId) {
        await updateDoc(doc(db, 'ingredients', editingId), ingredientData);
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'ingredients'), ingredientData);
      }
      resetForm();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'permission-denied') {
        setError('Permiso denegado al guardar. Verifica las reglas de Firestore.');
      } else {
        setError('Error al guardar.');
      }
    }
  };

  const handleEdit = (ing: Ingredient) => {
    setName(ing.name);
    setUnit(ing.unit);
    // Default quantity to 1 for existing items without it
    const qty = ing.quantity || 1;
    setQuantity(qty.toString());
    // Show total package price (unit price * count)
    setPrice((ing.pricePerUnit * qty).toString());
    setEditingId(ing.id);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar este ingrediente?')) {
      try {
        await deleteDoc(doc(db, 'ingredients', id));
      } catch (err) {
        console.error(err);
        setError('No se pudo eliminar. Permisos insuficientes.');
      }
    }
  };

  const resetForm = () => {
    setName('');
    setUnit(Unit.KG);
    setQuantity('1');
    setPrice('');
    setEditingId(null);
    setError('');
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-brand-brown/10">
        <h2 className="text-xl font-bold text-brand-brown mb-4 font-serif">
          {editingId ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-brand-brown mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-beige/50 placeholder-brand-brown/40"
              placeholder="Ej. Harina de Almendras"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-brand-brown mb-1">Unidad de Compra</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-24 p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-beige/50 placeholder-brand-brown/40"
                  placeholder="Cant."
                  required
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as Unit)}
                  className="flex-1 p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 bg-brand-beige/50 text-brand-brown cursor-pointer"
                >
                  {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-brand-brown mb-1">Precio</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-beige/50 placeholder-brand-brown/40"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          {error && <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm border border-red-100">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-brand-brown text-white py-3 rounded-xl font-bold hover:bg-[#4A2E21] transition shadow-md"
            >
              {editingId ? 'Actualizar' : 'Guardar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-3 bg-brand-brown/10 text-brand-brown rounded-xl font-bold hover:bg-brand-brown/20"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-bold text-brand-brown pl-1 font-serif">Inventario ({ingredients.length})</h3>
        {/* Search Field */}
        {ingredients.length > 0 && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-brown/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-brand-brown/15 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 text-brand-brown bg-brand-beige/30 placeholder-brand-brown/35 text-sm transition-all"
              placeholder="Buscar ingrediente..."
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-brown/40 hover:text-brand-brown transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        {ingredients.length === 0 ? (
          <p className="text-brand-brown/40 text-center py-8 italic">
            {error ? 'No se pudieron cargar datos.' : 'No hay ingredientes registrados.'}
          </p>
        ) : (
          ingredients.filter(ing => ing.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && searchTerm ? (
            <p className="text-brand-brown/40 text-center py-6 italic text-sm">No se encontraron resultados para "{searchTerm}"</p>
          ) : (
          ingredients.filter(ing => ing.name.toLowerCase().includes(searchTerm.toLowerCase())).map(ing => (
            <div key={ing.id} className="bg-white p-4 rounded-xl shadow-sm border border-brand-brown/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 hover:border-brand-brown/30 transition-colors">
              <div className="flex-1 pr-2">
                <h4 className="font-bold text-brand-brown break-words">{ing.name}</h4>
                <p className="text-sm text-brand-brown/60">
                  ${ing.pricePerUnit.toLocaleString()} / {ing.unit}
                </p>
                <div className="mt-2 inline-block px-3 py-1 rounded-lg border-2 border-brand-brown/20 bg-brand-brown/5">
                  <span className="text-xs font-bold text-brand-brown/70 block">Stock Actual:</span>
                  <span className={`text-lg font-bold text-brand-brown ${(ing.currentStock || 0) > 0 ? 'today-neon-glow' : ''} px-2 py-0.5 rounded`}>
                    {formatQuantity(ing.currentStock || 0, ing.unit)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(ing)}
                  className="p-2 text-brand-brown bg-brand-brown/5 rounded-lg hover:bg-brand-brown/10 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(ing.id)}
                  className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        ))}
      </div>
    </div>
  );
};

export default Ingredients;
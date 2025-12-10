import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { Ingredient, Unit } from '../types';

interface Props {
  userId: string;
}

const Ingredients: React.FC<Props> = ({ userId }) => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState<Unit>(Unit.KG);
  const [price, setPrice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

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
      const ingredientData = {
        name: trimmedName,
        unit,
        pricePerUnit: parseFloat(price),
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
    setPrice(ing.pricePerUnit.toString());
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
    setPrice('');
    setEditingId(null);
    setError('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100">
        <h2 className="text-xl font-bold text-rose-500 mb-4">
          {editingId ? 'Editar Ingrediente' : 'Nuevo Ingrediente'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-black bg-gray-50 placeholder-gray-400"
              placeholder="Ej. Harina de Almendras"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Unidad de Compra</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="w-full p-3 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-gray-50 text-black"
              >
                {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Precio</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full p-3 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-black bg-gray-50 placeholder-gray-400"
                placeholder="0.00"
                required
              />
            </div>
          </div>
          {error && <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm border border-red-100">{error}</div>}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 bg-rose-500 text-white py-3 rounded-xl font-bold hover:bg-rose-600 transition shadow-md"
            >
              {editingId ? 'Actualizar' : 'Guardar'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-3 bg-slate-200 text-slate-600 rounded-xl font-bold"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-700 pl-1">Inventario ({ingredients.length})</h3>
        {ingredients.length === 0 ? (
          <p className="text-slate-400 text-center py-8">
            {error ? 'No se pudieron cargar datos.' : 'No hay ingredientes registrados.'}
          </p>
        ) : (
          ingredients.map(ing => (
            <div key={ing.id} className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-rose-300 flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-800">{ing.name}</h4>
                <p className="text-sm text-slate-500">
                  ${ing.pricePerUnit.toLocaleString()} / {ing.unit}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(ing)}
                  className="p-2 text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(ing.id)}
                  className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100"
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
    </div>
  );
};

export default Ingredients;
import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, onSnapshot, QuerySnapshot, DocumentData, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Ingredient, Recipe, getConversionFactor } from '../types';

interface Props {
  userId: string;
}

interface LocalRecipeIngredient {
  ingredientId: string;
  quantityUsed: string;
}

const Recipes: React.FC<Props> = ({ userId }) => {
  // Data States
  const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  
  // Form States
  const [recipeName, setRecipeName] = useState('');
  const [ingredientsList, setIngredientsList] = useState<LocalRecipeIngredient[]>([]);
  const [totalYield, setTotalYield] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Feedback States
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch Ingredients (for the dropdowns)
  useEffect(() => {
    const q = query(collection(db, 'ingredients'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, 
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient));
        data.sort((a, b) => a.name.localeCompare(b.name));
        setAvailableIngredients(data);
      },
      (err) => console.error("Error loading ingredients:", err)
    );
    return () => unsubscribe();
  }, [userId]);

  // 2. Fetch Existing Recipes (for the list)
  useEffect(() => {
    const q = query(collection(db, 'recipes'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        // Sort by name
        data.sort((a, b) => a.name.localeCompare(b.name));
        setSavedRecipes(data);
      },
      (err) => console.error("Error loading recipes:", err)
    );
    return () => unsubscribe();
  }, [userId]);

  const addIngredientRow = () => {
    setIngredientsList([...ingredientsList, { ingredientId: '', quantityUsed: '' }]);
  };

  const removeIngredientRow = (index: number) => {
    const newList = [...ingredientsList];
    newList.splice(index, 1);
    setIngredientsList(newList);
  };

  const handleRowChange = (index: number, field: keyof LocalRecipeIngredient, value: string) => {
    const newList = [...ingredientsList];
    newList[index] = { ...newList[index], [field]: value };
    setIngredientsList(newList);
  };

  const calculateTotalCost = () => {
    let total = 0;
    ingredientsList.forEach(item => {
      const ing = availableIngredients.find(i => i.id === item.ingredientId);
      const qty = parseFloat(item.quantityUsed);
      if (ing && !isNaN(qty)) {
        const factor = getConversionFactor(ing.unit);
        total += (ing.pricePerUnit / factor) * qty;
      }
    });
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const yieldWeight = parseFloat(totalYield);
    if (!recipeName || ingredientsList.length === 0 || isNaN(yieldWeight) || yieldWeight <= 0) {
      alert("Por favor complete todos los campos correctamente.");
      return;
    }

    const totalCost = calculateTotalCost();
    const costPerGram = totalCost / yieldWeight;

    const finalIngredients = ingredientsList.map(item => {
      const ing = availableIngredients.find(i => i.id === item.ingredientId)!;
      const qty = parseFloat(item.quantityUsed);
      const factor = getConversionFactor(ing.unit);
      return {
        ingredientId: item.ingredientId,
        quantityUsed: qty,
        calculatedCost: (ing.pricePerUnit / factor) * qty
      };
    });

    const recipeData = {
      userId,
      name: recipeName,
      ingredients: finalIngredients,
      totalYieldWeight: yieldWeight,
      totalCost,
      costPerGram
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'recipes', editingId), recipeData);
        setSuccessMsg('Receta actualizada correctamente!');
      } else {
        await addDoc(collection(db, 'recipes'), recipeData);
        setSuccessMsg('Receta creada exitosamente!');
      }
      resetForm();
      setTimeout(() => setSuccessMsg(''), 3000);
      
      // Scroll to top to see success message
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      console.error(err);
      setErrorMsg('Error al guardar. Verifica tu conexión.');
    }
  };

  const handleEdit = (recipe: Recipe) => {
    setRecipeName(recipe.name);
    setTotalYield(recipe.totalYieldWeight.toString());
    
    // Transform ingredients back to local state
    const localIngredients = recipe.ingredients.map(i => ({
      ingredientId: i.ingredientId,
      quantityUsed: i.quantityUsed.toString()
    }));
    setIngredientsList(localIngredients);
    
    setEditingId(recipe.id);
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!id) return;
    
    if (window.confirm('¿Estás seguro de eliminar esta receta? Esta acción no se puede deshacer.')) {
      try {
        await deleteDoc(doc(db, 'recipes', id));
        
        // If we deleted the recipe being edited, clear the form
        if (editingId === id) {
          resetForm();
        }
        
        setSuccessMsg('Receta eliminada correctamente.');
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err) {
        console.error("Error al eliminar:", err);
        // Use alert for immediate feedback on list items
        alert('Error al eliminar la receta. Verifica tus permisos o conexión.');
      }
    }
  };

  const resetForm = () => {
    setRecipeName('');
    setIngredientsList([]);
    setTotalYield('');
    setEditingId(null);
    setErrorMsg('');
  };

  const getIngredientUnitLabel = (id: string) => {
    const ing = availableIngredients.find(i => i.id === id);
    if (!ing) return 'cant';
    switch (ing.unit) {
      case 'Kg': return 'gramos';
      case 'Lt': return 'ml';
      default: return 'unidades';
    }
  };

  const currentTotal = calculateTotalCost();

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* FORM SECTION */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100">
        <h2 className="text-xl font-bold text-rose-500 mb-4">
          {editingId ? 'Editar Receta' : 'Nueva Receta'}
        </h2>
        
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nombre de la Receta</label>
            <input
              type="text"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              className="w-full p-3 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-black bg-gray-50 placeholder-gray-400"
              placeholder="Ej. Torta de Chocolate Keto"
              required
            />
          </div>

          {/* Ingredients */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
               <label className="block text-sm font-medium text-slate-600">Ingredientes</label>
               <button
                  type="button"
                  onClick={addIngredientRow}
                  className="text-xs bg-rose-100 text-rose-600 px-3 py-1 rounded-full font-bold hover:bg-rose-200"
                >
                  + Agregar
                </button>
            </div>
            
            {ingredientsList.map((row, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-grow space-y-2">
                  <select
                    value={row.ingredientId}
                    onChange={(e) => handleRowChange(index, 'ingredientId', e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-rose-300 bg-gray-50 text-sm text-black"
                    required
                  >
                    <option value="">Seleccionar ingrediente...</option>
                    {availableIngredients.map(ing => (
                      <option key={ing.id} value={ing.id}>{ing.name}</option>
                    ))}
                  </select>
                  <div className="relative">
                    <input
                      type="number"
                      value={row.quantityUsed}
                      onChange={(e) => handleRowChange(index, 'quantityUsed', e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-rose-300 text-sm text-black bg-gray-50 placeholder-gray-400"
                      placeholder="Cantidad usada"
                      required
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">
                      {row.ingredientId ? getIngredientUnitLabel(row.ingredientId) : '-'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeIngredientRow(index)}
                  className="mt-1 p-2 text-red-400 hover:text-red-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
            {ingredientsList.length === 0 && (
              <p className="text-sm text-slate-400 italic text-center py-2 bg-slate-50 rounded-lg">Agrega ingredientes a la lista</p>
            )}
          </div>

          {/* Yield */}
          <div className="bg-rose-50 p-4 rounded-xl">
             <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-rose-600">Costo Ingredientes:</span>
                <span className="font-bold text-lg">${currentTotal.toFixed(2)}</span>
             </div>
             <label className="block text-sm font-medium text-slate-600 mb-1">Peso Final de la Preparación (Yield)</label>
             <div className="relative">
                <input
                  type="number"
                  value={totalYield}
                  onChange={(e) => setTotalYield(e.target.value)}
                  className="w-full p-3 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-black bg-white placeholder-gray-400"
                  placeholder="Total en gramos o unidades"
                  required
                />
                <span className="absolute right-3 top-3.5 text-sm text-slate-400">gr/un</span>
             </div>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-rose-500 text-white py-4 rounded-xl font-bold hover:bg-rose-600 transition shadow-lg text-lg"
            >
              {editingId ? 'Actualizar Receta' : 'Guardar Receta'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-4 bg-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-300 transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* LIST SECTION */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-700 pl-2 border-l-4 border-rose-400">
          Mis Recetas ({savedRecipes.length})
        </h3>
        
        {savedRecipes.length === 0 ? (
          <p className="text-center text-slate-400 py-8 italic">No tienes recetas guardadas aún.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedRecipes.map(recipe => (
              <div key={recipe.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between hover:shadow-md transition">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-lg text-slate-800 leading-tight">{recipe.name}</h4>
                    <span className="bg-rose-100 text-rose-600 text-xs font-bold px-2 py-1 rounded-lg">
                      {recipe.ingredients.length} Ingred.
                    </span>
                  </div>
                  
                  <div className="space-y-1 text-sm text-slate-600 mb-4">
                    <p className="flex justify-between">
                      <span>Rendimiento (Yield):</span>
                      <span className="font-medium">{recipe.totalYieldWeight} gr/un</span>
                    </p>
                    <p className="flex justify-between">
                      <span>Costo Total:</span>
                      <span className="font-medium">${recipe.totalCost.toFixed(2)}</span>
                    </p>
                    <div className="pt-2 mt-2 border-t border-slate-100 flex justify-between text-rose-600 font-bold">
                      <span>Costo Base:</span>
                      <span>${recipe.costPerGram.toFixed(4)} / gr</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-2 pt-3 border-t border-slate-50">
                  <button 
                    type="button"
                    onClick={() => handleEdit(recipe)}
                    className="flex-1 py-2 text-sm font-semibold text-rose-500 bg-rose-50 rounded-lg hover:bg-rose-100 transition flex justify-center items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => handleDelete(e, recipe.id)}
                    className="flex-1 py-2 text-sm font-semibold text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition flex justify-center items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {successMsg && (
        <div className="fixed bottom-20 md:bottom-10 left-4 right-4 bg-green-500 text-white p-4 rounded-xl text-center shadow-lg animate-bounce z-50">
          {successMsg}
        </div>
      )}
    </div>
  );
};

export default Recipes;
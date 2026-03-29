import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, writeBatch, addDoc, QuerySnapshot, DocumentData, orderBy, limit, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Ingredient, Recipe, getConversionFactor, Unit, ProductionLog, formatQuantity } from '../types';

interface StockModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const StockModal: React.FC<StockModalProps> = ({ isOpen, onClose, userId }) => {
    const [view, setView] = useState<'menu' | 'stock' | 'production'>('menu');
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    // Safety check for hooks ordering - initialized at top
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Stock Form States
    const [selectedIngId, setSelectedIngId] = useState('');
    const [qtyBought, setQtyBought] = useState('');
    const [totalPrice, setTotalPrice] = useState('');
    const [isDiscarding, setIsDiscarding] = useState(false);

    // New Ingredient States
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [newIngName, setNewIngName] = useState('');
    const [newIngUnit, setNewIngUnit] = useState<Unit>(Unit.KG);

    // Production Form States
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [selectedRecipeId, setSelectedRecipeId] = useState('');
    const [productionQty, setProductionQty] = useState('');

    // Production History State
    const [productionHistory, setProductionHistory] = useState<ProductionLog[]>([]);
    const [editingLogId, setEditingLogId] = useState<string | null>(null);

    // Fetch Recipes
    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, 'recipes'), where('userId', '==', userId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
            data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setRecipes(data);
        });
        return () => unsubscribe();
    }, [userId]);

    // Fetch Production History
    useEffect(() => {
        if (!userId) return;
        const q = query(
            collection(db, 'production_logs'),
            where('userId', '==', userId),
            orderBy('date', 'desc'),
            limit(20)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductionLog));
            setProductionHistory(data);
        });
        return () => unsubscribe();
    }, [userId]);

    // Fetch Ingredients
    useEffect(() => {
        if (!userId) return;
        const q = query(collection(db, 'ingredients'), where('userId', '==', userId));
        const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient));
            data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setIngredients(data);
        });
        return () => unsubscribe();
    }, [userId]);

    // Reset view when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setView('menu');
            setMsg(null);
            resetForm();
            setEditingLogId(null);
        }
    }, [isOpen]);

    const resetForm = () => {
        setSelectedIngId('');
        setQtyBought('');
        setTotalPrice('');
        setIsAddingNew(false);
        setNewIngName('');
        setNewIngUnit(Unit.KG);
        setSelectedRecipeId('');
        setProductionQty('');
        setEditingLogId(null);
        setIsDiscarding(false);
    };

    const handleAddNewIngredient = async () => {
        if (!newIngName.trim()) {
            setMsg({ type: 'error', text: 'El nombre es requerido' });
            return;
        }

        setLoading(true);
        try {
            const docRef = await addDoc(collection(db, 'ingredients'), {
                name: newIngName.trim(),
                unit: newIngUnit,
                quantity: 0,
                currentStock: 0,
                pricePerUnit: 0,
                userId
            });

            setIsAddingNew(false);
            setSelectedIngId(docRef.id);
            setNewIngName('');
            setMsg({ type: 'success', text: 'Ingrediente creado. Ahora ingresa su compra.' });
        } catch (err: any) {
            console.error(err);
            setMsg({ type: 'error', text: 'Error al crear ingrediente' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStock = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        try {
            const ing = ingredients.find(i => i.id === selectedIngId);
            if (!ing) throw new Error("Ingrediente no encontrado");

            const qty = parseFloat(qtyBought);
            const price = parseFloat(totalPrice);

            if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
                throw new Error("Por favor ingrese valores válidos");
            }

            // 1. Calculate new unit price
            const newPricePerUnit = price / qty;

            // 2. Update Ingredient in Firestore
            // Calculate new stock quantity: currentStock + qtyBought
            const currentStock = ing.currentStock || 0;
            const newStock = currentStock + qty;

            const batch = writeBatch(db);
            const ingRef = doc(db, 'ingredients', ing.id);
            batch.update(ingRef, {
                pricePerUnit: newPricePerUnit,
                currentStock: newStock
            });

            // 3. Cascade Update to Recipes
            // Fetch all recipes (we need to check them all to see if they use this ingredient)
            // Ideally we would query only relevant recipes, but 'array-contains' works on primitive values, not object fields easily.
            // Given the scale, fetching all is acceptable.
            const recipesSnapshot = await getDocs(query(collection(db, 'recipes'), where('userId', '==', userId)));

            let recipesUpdatedCount = 0;

            recipesSnapshot.forEach((recipeDoc) => {
                const recipe = recipeDoc.data() as Recipe;
                let needsUpdate = false;

                const updatedIngredients = (recipe.ingredients || []).map(ri => {
                    if (ri.ingredientId === ing.id) {
                        needsUpdate = true;
                        const factor = getConversionFactor(ing.unit);
                        const newCost = (newPricePerUnit / factor) * ri.quantityUsed;
                        return { ...ri, calculatedCost: newCost };
                    }
                    return ri;
                });

                if (needsUpdate) {
                    const newTotalCost = updatedIngredients.reduce((sum, item) => sum + item.calculatedCost, 0);
                    const newCostPerGram = newTotalCost / recipe.totalYieldWeight;

                    const recipeRef = doc(db, 'recipes', recipeDoc.id);
                    batch.update(recipeRef, {
                        ingredients: updatedIngredients,
                        totalCost: newTotalCost,
                        costPerGram: newCostPerGram
                    });
                    recipesUpdatedCount++;
                }
            });

            await batch.commit();
            setMsg({ type: 'success', text: `Stock actualizado! ${recipesUpdatedCount} receta(s) recalculadas.` });
            resetForm();

        } catch (error: any) {
            console.error(error);
            setMsg({ type: 'error', text: error.message || "Error al actualizar" });
        } finally {
            setLoading(false);
        }
    };



    const handleDiscardStock = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        try {
            const ing = ingredients.find(i => i.id === selectedIngId);
            if (!ing) throw new Error("Ingrediente no encontrado");

            const qty = parseFloat(qtyBought);
            if (isNaN(qty) || qty <= 0) throw new Error("Ingrese una cantidad válida");

            const newStock = (ing.currentStock || 0) - qty;

            await updateDoc(doc(db, 'ingredients', ing.id), {
                currentStock: newStock
            });

            setMsg({ type: 'success', text: `Se reportó la pérdida de ${qty} ${ing.unit}. Stock actualizado.` });
            setQtyBought('');

        } catch (error: any) {
            console.error(error);
            setMsg({ type: 'error', text: error.message });
        } finally {
            setLoading(false);
        }
    };

    const renderMenu = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 stagger-children">
            <button
                onClick={() => setView('stock')}
                className="flex flex-col items-center justify-center p-8 glass-card rounded-2xl hover:shadow-lg transition-all duration-300 group card-hover-lift animate-fade-in-up"
            >
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">📦</div>
                <h3 className="text-xl font-bold text-brand-brown mb-2">Stock</h3>
                <p className="text-sm text-center text-brand-brown/60">
                    Gestiona tu inventario de insumos y materia prima
                </p>
            </button>

            <button
                onClick={() => setView('production')}
                className="flex flex-col items-center justify-center p-8 glass-card rounded-2xl hover:shadow-lg transition-all duration-300 group card-hover-lift animate-fade-in-up"
            >
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">👩‍🍳</div>
                <h3 className="text-xl font-bold text-brand-brown mb-2">Producción</h3>
                <p className="text-sm text-center text-brand-brown/60">
                    Controla tu cocina y planificación de horneado
                </p>
            </button>
        </div>
    );

    const renderStockView = () => {
        const selectedIng = ingredients.find(i => i.id === selectedIngId);

        return (
            <div className="p-6 md:p-8 flex flex-col h-full max-h-[85vh] overflow-hidden">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className="text-xl font-bold text-brand-brown flex items-center gap-2">
                        <span className="text-2xl">📦</span> Actualizar Stock
                    </h3>
                    <button
                        onClick={() => setView('menu')}
                        className="text-sm text-brand-brown/60 hover:text-brand-brown font-bold"
                    >
                        ← Volver
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    <div className="space-y-6 max-w-md mx-auto mb-8">
                        <div>
                            <label className="block text-sm font-bold text-brand-brown mb-1">Materia Prima</label>
                            {!isAddingNew ? (
                                <div className="flex gap-2">
                                    <select
                                        value={selectedIngId}
                                        onChange={(e) => setSelectedIngId(e.target.value)}
                                        className="flex-1 p-3 rounded-xl border border-brand-brown/20 bg-brand-beige/50 text-brand-brown focus:ring-2 focus:ring-brand-accent/50 outline-none"
                                    >
                                        <option value="">Seleccionar ingrediente...</option>
                                        {ingredients.map(ing => (
                                            <option key={ing.id} value={ing.id}>{ing.name} (Actual: ${ing.pricePerUnit}/{ing.unit})</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => setIsAddingNew(true)}
                                        className="p-3 bg-brand-brown text-white rounded-xl hover:bg-brand-brown/80 font-bold transition-colors shadow-sm flex items-center justify-center w-12"
                                        title="Agregar Nuevo Ingrediente"
                                    >
                                        <span className="text-xl leading-none pb-1">+</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-brand-brown/5 p-4 rounded-xl border border-brand-brown/10 animate-in fade-in slide-in-from-top-2">
                                    <h4 className="font-bold text-brand-brown mb-3 text-sm">Nuevo Ingrediente</h4>
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            value={newIngName}
                                            onChange={e => setNewIngName(e.target.value)}
                                            placeholder="Nombre (ej. Harina de Coco)"
                                            className="w-full p-2.5 rounded-lg border border-brand-brown/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                                            autoFocus
                                        />
                                        <select
                                            value={newIngUnit}
                                            onChange={e => setNewIngUnit(e.target.value as Unit)}
                                            className="w-full p-2.5 rounded-lg border border-brand-brown/20 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                                        >
                                            {Object.values(Unit).map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                        <div className="flex gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={handleAddNewIngredient}
                                                disabled={loading}
                                                className="flex-1 bg-brand-brown text-white py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-[#4A2E21]"
                                            >
                                                Guardar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setIsAddingNew(false)}
                                                className="px-3 py-2 bg-stone-200 text-stone-600 rounded-lg text-sm font-bold hover:bg-stone-300"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Toggle Operation Mode */}
                        {!isAddingNew && selectedIngId && (
                            <div className="flex gap-2 mb-6 bg-brand-brown/5 p-1 rounded-xl">
                                <button
                                    onClick={() => setIsDiscarding(false)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!isDiscarding
                                        ? 'bg-white text-brand-brown shadow-sm'
                                        : 'text-brand-brown/60 hover:text-brand-brown'
                                        }`}
                                >
                                    📥 Registrar Compra
                                </button>
                                <button
                                    onClick={() => setIsDiscarding(true)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${isDiscarding
                                        ? 'bg-red-50 text-red-600 shadow-sm ring-1 ring-red-100'
                                        : 'text-brand-brown/60 hover:text-red-500'
                                        }`}
                                >
                                    🗑️ Reportar Pérdida
                                </button>
                            </div>
                        )}

                        <form onSubmit={isDiscarding ? handleDiscardStock : handleUpdateStock} className={`space-y-6 transition-opacity duration-200 ${isAddingNew ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>

                            <div className="grid grid-cols-1 gap-4">
                                {isDiscarding ? (
                                    // Discard Form
                                    <div>
                                        <label className="block text-sm font-bold text-red-600 mb-1">
                                            Cantidad Desechada / Perdida
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="any"
                                                value={qtyBought}
                                                onChange={(e) => setQtyBought(e.target.value)}
                                                className="w-full p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 focus:ring-2 focus:ring-red-200 outline-none"
                                                placeholder="0"
                                                required
                                            />
                                            <span className="absolute right-3 top-3 text-sm text-red-400 font-bold">
                                                {selectedIng ? selectedIng.unit : '-'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-red-500 mt-2">
                                            ⚠ Esta acción descontará stock sin modificar el precio promedio.
                                        </p>
                                    </div>
                                ) : (
                                    // Purchase Form
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-brand-brown mb-1">
                                                Cantidad Comprada
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={qtyBought}
                                                    onChange={(e) => setQtyBought(e.target.value)}
                                                    className="w-full p-3 rounded-xl border border-brand-brown/20 bg-brand-beige/50 text-brand-brown focus:ring-2 focus:ring-brand-accent/50 outline-none"
                                                    placeholder="0"
                                                    required
                                                />
                                                <span className="absolute right-3 top-3 text-sm text-brand-brown/40 font-bold">
                                                    {selectedIng ? selectedIng.unit : '-'}
                                                </span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-brand-brown mb-1">
                                                Precio Total Pagado
                                            </label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3 text-brand-brown/40 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={totalPrice}
                                                    onChange={(e) => setTotalPrice(e.target.value)}
                                                    className="w-full p-3 pl-7 rounded-xl border border-brand-brown/20 bg-brand-beige/50 text-brand-brown focus:ring-2 focus:ring-brand-accent/50 outline-none"
                                                    placeholder="0.00"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Preview Calculation (Only for Purchase) */}
                            {!isDiscarding && selectedIng && qtyBought && totalPrice && !isNaN(parseFloat(qtyBought)) && !isNaN(parseFloat(totalPrice)) && (
                                <div className="bg-brand-brown/5 p-4 rounded-xl border border-brand-brown/10 text-center">
                                    <p className="text-sm text-brand-brown/70 mb-1">Nuevo Precio por {selectedIng.unit}</p>
                                    <p className="text-2xl font-bold text-brand-brown">
                                        ${(parseFloat(totalPrice) / parseFloat(qtyBought)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-brand-brown/50 mt-1">
                                        Anterior: ${selectedIng.pricePerUnit.toLocaleString()}
                                    </p>
                                </div>
                            )}

                            {msg && (
                                <div className={`p-3 rounded-lg text-sm text-center ${msg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {msg.text}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 transition-all font-serif ${isDiscarding
                                    ? 'bg-red-500 text-white hover:bg-red-600'
                                    : 'bg-brand-brown text-white hover:bg-[#4A2E21]'
                                    }`}
                            >
                                {loading
                                    ? 'Procesando...'
                                    : (isDiscarding ? 'Confirmar Pérdida de Stock' : 'Actualizar Stock y Precios')
                                }
                            </button>

                            {!isDiscarding && (
                                <p className="text-xs text-center text-brand-brown/50 px-4">
                                    Al actualizar, se recalcularán automáticamente los costos de todas las recetas que usen este ingrediente.
                                </p>
                            )}
                        </form>
                    </div>

                    <div className="border-t border-brand-brown/10 pt-6">
                        <h4 className="text-lg font-bold text-brand-brown mb-4 flex items-center gap-2">
                            <span>📋</span> Inventario Actual
                        </h4>
                        <div className="bg-brand-beige/30 rounded-xl overflow-hidden border border-brand-brown/10">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-brand-brown/5 text-brand-brown font-bold">
                                    <tr>
                                        <th className="p-3">Ingrediente</th>
                                        <th className="p-3 text-right">Precio Actual</th>
                                        <th className="p-3 text-center">Stock</th>
                                        <th className="p-3 text-center">Unidad</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-brown/5">
                                    {ingredients.map(ing => (
                                        <tr
                                            key={ing.id}
                                            className="hover:bg-brand-brown/5 cursor-pointer transition-colors"
                                            onClick={() => setSelectedIngId(ing.id)}
                                        >
                                            <td className="p-3 font-medium text-brand-brown">{ing.name}</td>
                                            <td className="p-3 text-right font-mono text-brand-brown/80">
                                                ${ing.pricePerUnit.toLocaleString('es-ES', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-3 text-center font-bold text-brand-brown" colSpan={2}>
                                                <span className={`${(ing.currentStock || 0) < 0 ? 'text-red-500 font-bold' : ((ing.currentStock || 0) > 0 ? 'today-neon-glow' : 'text-brand-brown/40')} px-2 py-1 rounded inline-block`}>
                                                    {formatQuantity(ing.currentStock || 0, ing.unit)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {ingredients.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="p-6 text-center text-brand-brown/40 italic">
                                                No hay ingredientes registrados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

        );
    };



    const handleRegisterProduction = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);
        setLoading(true);

        try {
            const recipe = recipes.find(r => r.id === selectedRecipeId);
            if (!recipe) throw new Error("Receta no encontrada");

            const qty = parseFloat(productionQty);
            if (isNaN(qty) || qty <= 0) throw new Error("Cantidad inválida");

            if (!recipe.totalYieldWeight || recipe.totalYieldWeight <= 0) {
                throw new Error("La receta no tiene un peso final definido para calcular proporciones.");
            }

            // Calculate Ratio: Production / Yield
            const ratio = qty / recipe.totalYieldWeight;

            // 1. Pre-Check: Validate Stock Availability
            const missingIngredients: string[] = [];

            for (const item of (recipe.ingredients || [])) {
                const ingredient = ingredients.find(i => i.id === item.ingredientId);
                if (ingredient) {
                    const factor = getConversionFactor(ingredient.unit);
                    let requiredAmount = (item.quantityUsed / factor) * ratio;

                    // If editing, we consider the amount we are "returning" to stock first
                    if (editingLogId) {
                        const oldLog = productionHistory.find(l => l.id === editingLogId);
                        if (oldLog) {
                            const oldRecipe = recipes.find(r => r.id === oldLog.recipeId);
                            if (oldRecipe && oldRecipe.totalYieldWeight) {
                                const recoveryRatio = oldLog.quantityProduced / oldRecipe.totalYieldWeight;
                                const amountRecovered = (item.quantityUsed / factor) * recoveryRatio;

                                // Net required is what we need MINUS what we already used (that we are "putting back" conceptually)
                                // Actually simpler: effective stock = current + amountRecovered. 
                                // Check: (current + recovered) < required?

                                if (((ingredient.currentStock || 0) + amountRecovered) < requiredAmount) {
                                    missingIngredients.push(ingredient.name);
                                }
                                continue;
                            }
                        }
                    }

                    // Normal Check
                    if ((ingredient.currentStock || 0) < requiredAmount) {
                        missingIngredients.push(ingredient.name);
                    }
                }
            }

            if (missingIngredients.length > 0) {
                throw new Error(`Stock insuficiente: ${missingIngredients.join(', ')}`);
            }


            // 2. Execute Updates
            const batch = writeBatch(db);
            let ingredientsUpdatedCount = 0;

            for (const item of (recipe.ingredients || [])) {
                const ingredient = ingredients.find(i => i.id === item.ingredientId);
                if (ingredient) {
                    const factor = getConversionFactor(ingredient.unit);
                    let netChange = -((item.quantityUsed / factor) * ratio); // Default: consume new amount

                    // If editing, add back old amount
                    if (editingLogId) {
                        const oldLog = productionHistory.find(l => l.id === editingLogId);
                        if (oldLog) {
                            const oldRecipe = recipes.find(r => r.id === oldLog.recipeId);
                            if (oldRecipe && oldRecipe.totalYieldWeight) {
                                const recoveryRatio = oldLog.quantityProduced / oldRecipe.totalYieldWeight;
                                netChange += ((item.quantityUsed / factor) * recoveryRatio);
                            }
                        }
                    }

                    const newStock = (ingredient.currentStock || 0) + netChange;

                    const ingRef = doc(db, 'ingredients', ingredient.id);
                    batch.update(ingRef, { currentStock: newStock });
                    ingredientsUpdatedCount++;
                }
            }

            // Save Log
            if (editingLogId) {
                const logRef = doc(db, 'production_logs', editingLogId);
                batch.update(logRef, {
                    quantityProduced: qty,
                    recipeId: recipe.id,
                    recipeName: recipe.name,
                    date: new Date() // Update date on edit too
                });
            } else {
                const logRef = doc(collection(db, 'production_logs'));
                batch.set(logRef, {
                    userId,
                    recipeId: recipe.id,
                    recipeName: recipe.name,
                    quantityProduced: qty,
                    date: new Date()
                });
            }

            await batch.commit();

            setMsg({
                type: 'success',
                text: editingLogId
                    ? `Producción actualizada. Stock recalculado.`
                    : `Producción registrada. Se descontaron insumos de ${ingredientsUpdatedCount} ingredientes`
            });

            setProductionQty('');
            setEditingLogId(null);
            // Optional: setSelectedRecipeId('');

        } catch (error: any) {
            console.error(error);
            setMsg({ type: 'error', text: error.message || "Error al registrar producción" });
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteLog = async (log: ProductionLog) => {
        if (!confirm("¿Eliminar registro? Esto devolverá los ingredientes al stock.")) return;
        setLoading(true);
        try {
            // Revert Stock
            // We need to fetch the recipe to know what to put back
            const recipeDoc = await getDoc(doc(db, 'recipes', log.recipeId));
            if (recipeDoc.exists()) {
                const recipe = recipeDoc.data() as Recipe;
                if (!recipe.totalYieldWeight || recipe.totalYieldWeight <= 0) {
                    throw new Error("La receta original no tiene un peso final definido para calcular proporciones.");
                }
                const ratio = log.quantityProduced / recipe.totalYieldWeight;

                const batch = writeBatch(db);
                for (const item of (recipe.ingredients || [])) {
                    const ingredient = ingredients.find(i => i.id === item.ingredientId);
                    if (ingredient) {
                        const factor = getConversionFactor(ingredient.unit);
                        const recovery = (item.quantityUsed / factor) * ratio;
                        const newStock = (ingredient.currentStock || 0) + recovery;
                        batch.update(doc(db, 'ingredients', ingredient.id), { currentStock: newStock });
                    }
                }
                batch.delete(doc(db, 'production_logs', log.id));
                await batch.commit();
                setMsg({ type: 'success', text: "Registro eliminado y stock devuelto." });
            } else {
                // Recipe deleted? Just delete log
                await deleteDoc(doc(db, 'production_logs', log.id));
                setMsg({ type: 'success', text: "Registro eliminado (Receta original no encontrada, stock no modificado)." });
            }
        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || "Error al eliminar" });
        } finally {
            setLoading(false);
        }
    }

    const startEditLog = (log: ProductionLog) => {
        setEditingLogId(log.id);
        setSelectedRecipeId(log.recipeId);
        setProductionQty(log.quantityProduced.toString());
        // Scroll to top form
        const form = document.querySelector('form');
        if (form) form.scrollIntoView({ behavior: 'smooth' });
    }

    const cancelEdit = () => {
        setEditingLogId(null);
        setProductionQty('');
        setSelectedRecipeId('');
    }

    if (!isOpen) return null;

    const renderProductionView = () => (
        <div className="p-6 md:p-8 flex flex-col h-full max-h-[85vh] overflow-hidden">
            <div className="flex justify-between items-center mb-6 shrink-0">
                <h3 className="text-xl font-bold text-brand-brown flex items-center gap-2">
                    <span className="text-2xl">👩‍🍳</span> Registrar Producción
                </h3>
                <button
                    onClick={() => setView('menu')}
                    className="text-sm text-brand-brown/60 hover:text-brand-brown font-bold"
                >
                    ← Volver
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 max-w-lg mx-auto w-full">
                <form onSubmit={handleRegisterProduction} className="space-y-6">
                    <div className={`bg-brand-cream border border-[#E5DCD3] p-6 rounded-2xl shadow-sm transition-all ${editingLogId ? 'ring-2 ring-brand-accent/50' : ''}`}>
                        {editingLogId && (
                            <div className="mb-4 flex justify-between items-center bg-brand-accent/10 p-2 rounded text-xs text-brand-brown font-bold">
                                <span>✏️ Editando registro pasado</span>
                                <button type="button" onClick={cancelEdit} className="text-red-500 hover:underline">Cancelar</button>
                            </div>
                        )}
                        <p className="text-sm text-brand-brown/70 mb-4">
                            Selecciona una receta y la cantidad producida. La app descontará automáticamente los ingredientes del stock proporcionalmente.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-brand-brown mb-1">Receta Elaborada</label>
                                <select
                                    value={selectedRecipeId}
                                    onChange={(e) => setSelectedRecipeId(e.target.value)}
                                    className="w-full p-3 rounded-xl border border-brand-brown/20 bg-white text-brand-brown focus:ring-2 focus:ring-brand-accent/50 outline-none"
                                    required
                                >
                                    <option value="">Seleccionar receta...</option>
                                    {recipes.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.name} (Rinde: {r.totalYieldWeight}g)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-brand-brown mb-1">Cantidad Obtenida (Gramos)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="any"
                                        value={productionQty}
                                        onChange={(e) => setProductionQty(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-brand-brown/20 bg-white text-brand-brown focus:ring-2 focus:ring-brand-accent/50 outline-none"
                                        placeholder="Ej. 1200"
                                        required
                                    />
                                    <span className="absolute right-3 top-3 text-sm text-brand-brown/40 font-bold">gr</span>
                                </div>
                                {selectedRecipeId && productionQty && (() => {
                                    const r = recipes.find(x => x.id === selectedRecipeId);
                                    if (r && r.totalYieldWeight) {
                                        const percentage = (parseFloat(productionQty) / r.totalYieldWeight) * 100;
                                        return (
                                            <p className="text-xs text-brand-brown/60 mt-2 text-right">
                                                Equivale al <span className="font-bold">{percentage.toFixed(1)}%</span> de la receta original
                                            </p>
                                        )
                                    }
                                })()}
                            </div>
                        </div>
                    </div>

                    {msg && (
                        <div className={`p-4 rounded-xl text-sm text-center border ${msg.type === 'success' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                            {msg.text}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !selectedRecipeId || !productionQty}
                        className="w-full bg-brand-brown text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-[#4A2E21] disabled:opacity-50 transition-all font-serif"
                    >
                        {loading ? 'Procesando...' : (editingLogId ? 'Actualizar Producción' : 'Registrar y Descontar Stock')}
                    </button>
                </form>

                {/* Historial de Producción */}
                <div className="mt-12 border-t border-brand-brown/10 pt-6">
                    <h4 className="text-lg font-bold text-brand-brown mb-4 flex items-center gap-2">
                        <span>📜</span> Historial Reciente (Últimos 20)
                    </h4>
                    <div className="space-y-3">
                        {productionHistory.map(log => (
                            <div key={log.id} className="bg-white border border-brand-brown/10 p-4 rounded-xl flex justify-between items-center hover:shadow-md transition-shadow">
                                <div>
                                    <p className="font-bold text-brand-brown">{log.recipeName}</p>
                                    <p className="text-sm text-brand-brown/60">
                                        producidos <span className="font-mono font-bold text-brand-brown">{log.quantityProduced}g</span>
                                        {' • '}
                                        {log.date?.toDate ? log.date.toDate().toLocaleDateString() : 'Fecha desc.'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => startEditLog(log)}
                                        className="p-2 text-brand-brown/40 hover:text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors"
                                        title="Editar cantidad"
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        onClick={() => handleDeleteLog(log)}
                                        className="p-2 text-brand-brown/40 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar registro"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}
                        {productionHistory.length === 0 && (
                            <p className="text-center text-brand-brown/40 italic py-4">No hay registros recientes.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-brand-brown p-4 flex justify-between items-center text-white">
                    <h2 className="text-xl font-bold font-serif flex items-center gap-2">
                        {view === 'menu' && <span>🏭 Control de Planta</span>}
                        {view === 'stock' && <span>📦 Stock</span>}
                        {view === 'production' && <span>👩‍🍳 Producción</span>}
                    </h2>
                    <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                        ✕
                    </button>
                </div>

                {view === 'menu' && renderMenu()}
                {view === 'stock' && renderStockView()}
                {view === 'production' && renderProductionView()}
            </div>
        </div>
    );
};

export default StockModal;

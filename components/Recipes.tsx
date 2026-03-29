import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, query, where, onSnapshot, QuerySnapshot, DocumentData, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Ingredient, Recipe, getConversionFactor, Unit, formatQuantity } from '../types';

interface Props {
  userId: string;
}

interface LocalRecipeIngredient {
  ingredientId: string;
  type?: 'ingredient' | 'recipe';
  quantityUsed: string;
  unitUsed: string;
}

interface LocalPromoItem {
  recipeId: string;
  quantityUsed: string;
}

const Recipes: React.FC<Props> = ({ userId }) => {
  // Data States
  const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);

  // Form States
  const [recipeName, setRecipeName] = useState('');
  const [ingredientsList, setIngredientsList] = useState<LocalRecipeIngredient[]>([]);
  const [promoItemsList, setPromoItemsList] = useState<LocalPromoItem[]>([]);
  const [isPromoMode, setIsPromoMode] = useState(false);
  const [isIngredientRecipe, setIsIngredientRecipe] = useState(false);
  const [totalYield, setTotalYield] = useState('');
  // Nutritional Info State
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [portionWeight, setPortionWeight] = useState('');
  const [conservation, setConservation] = useState('');
  const [yieldUnit, setYieldUnit] = useState('gr');

  // Catalog States
  const [showInCatalog, setShowInCatalog] = useState(false);
  const [catalogPrice, setCatalogPrice] = useState('');
  const [catalogDescription, setCatalogDescription] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null);

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
    setIngredientsList([...ingredientsList, { ingredientId: '', type: 'ingredient', quantityUsed: '', unitUsed: 'gr' }]);
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

  const addPromoItemRow = () => {
    setPromoItemsList([...promoItemsList, { recipeId: '', quantityUsed: '' }]);
  };

  const removePromoItemRow = (index: number) => {
    const newList = [...promoItemsList];
    newList.splice(index, 1);
    setPromoItemsList(newList);
  };

  const handlePromoRowChange = (index: number, field: keyof LocalPromoItem, value: string) => {
    const newList = [...promoItemsList];
    newList[index] = { ...newList[index], [field]: value };
    setPromoItemsList(newList);
  };

  const calculateTotalCost = () => {
    let total = 0;
    if (isPromoMode) {
      promoItemsList.forEach(item => {
        const recipe = savedRecipes.find(r => r.id === item.recipeId);
        const qty = parseFloat(item.quantityUsed);
        if (recipe && !isNaN(qty)) {
          total += recipe.costPerGram * qty;
        }
      });
    } else {
      ingredientsList.forEach(item => {
        if (item.type === 'recipe') {
          const recipe = savedRecipes.find(r => r.id === item.ingredientId);
          const qty = parseFloat(item.quantityUsed);
          if (recipe && !isNaN(qty)) {
            // If sub-recipe, base unit is grams OR porción. 
            // We assume if they choose something other than 'gr', it's special.
            // But usually we just store grams.
            total += recipe.costPerGram * qty;
          }
        } else {
          const ing = availableIngredients.find(i => i.id === item.ingredientId);
          const qty = parseFloat(item.quantityUsed);
          if (ing && !isNaN(qty)) {
            const factor = getConversionFactor(ing.unit);
            // Convert input to base unit (grams/ml)
            const inputFactor = getConversionFactor(item.unitUsed);
            const baseQty = qty * inputFactor;
            total += (ing.pricePerUnit / factor) * baseQty;
          }
        }
      });
    }
    return total;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const totalCost = calculateTotalCost();
    // Convert yield to grams if it's Kg/Lt
    const yieldInputFactor = getConversionFactor(yieldUnit);
    const yieldWeight = isPromoMode ? 1 : (parseFloat(totalYield) * yieldInputFactor);
    
    if (!recipeName || (!isPromoMode && (isNaN(yieldWeight) || yieldWeight <= 0))) {
      alert("Por favor complete todos los campos correctamente.");
      return;
    }

    if (isPromoMode && promoItemsList.length === 0) {
      alert("Agrega al menos una receta a la promoción.");
      return;
    }
    if (!isPromoMode && ingredientsList.length === 0) {
      alert("Agrega al menos un ingrediente a la receta.");
      return;
    }

    const costPerGram = totalCost / yieldWeight;

    const finalIngredients = isPromoMode ? [] : ingredientsList.map(item => {
      if (item.type === 'recipe') {
        const recipe = savedRecipes.find(r => r.id === item.ingredientId)!;
        const qty = parseFloat(item.quantityUsed);
        return {
          ingredientId: item.ingredientId,
          type: 'recipe' as const,
          quantityUsed: qty,
          calculatedCost: recipe.costPerGram * qty
        };
      } else {
        const ing = availableIngredients.find(i => i.id === item.ingredientId)!;
        const qty = parseFloat(item.quantityUsed);
        const factor = getConversionFactor(ing.unit);
        const inputFactor = getConversionFactor(item.unitUsed);
        const baseQty = qty * inputFactor;

        return {
          ingredientId: item.ingredientId,
          type: 'ingredient' as const,
          quantityUsed: baseQty,
          calculatedCost: (ing.pricePerUnit / factor) * baseQty
        };
      }
    });

    const finalPromoItems = isPromoMode ? promoItemsList.map(item => {
      const recipe = savedRecipes.find(r => r.id === item.recipeId)!;
      const qty = parseFloat(item.quantityUsed);
      return {
        recipeId: item.recipeId,
        quantityUsed: qty,
        calculatedCost: recipe.costPerGram * qty
      };
    }) : [];

    let autoCalories = 0, autoProtein = 0, autoCarbs = 0, autoFat = 0, autoFiber = 0;
    if (isPromoMode) {
      promoItemsList.forEach(item => {
        const r = savedRecipes.find(rr => rr.id === item.recipeId);
        const qty = parseFloat(item.quantityUsed);
        if (r && r.nutritionalInfo && r.totalYieldWeight && !isNaN(qty) && r.totalYieldWeight > 0) {
          const factor = qty / r.totalYieldWeight;
          autoCalories += (r.nutritionalInfo.calories || 0) * factor;
          autoProtein += (r.nutritionalInfo.protein || 0) * factor;
          autoCarbs += (r.nutritionalInfo.carbs || 0) * factor;
          autoFat += (r.nutritionalInfo.fat || 0) * factor;
          autoFiber += (r.nutritionalInfo.fiber || 0) * factor;
        }
      });
    } else {
      ingredientsList.forEach(item => {
        if (item.type === 'recipe') {
          const r = savedRecipes.find(rr => rr.id === item.ingredientId);
          const qty = parseFloat(item.quantityUsed);
          if (r && r.nutritionalInfo && r.totalYieldWeight && !isNaN(qty) && r.totalYieldWeight > 0) {
            const factor = qty / r.totalYieldWeight;
            autoCalories += (r.nutritionalInfo.calories || 0) * factor;
            autoProtein += (r.nutritionalInfo.protein || 0) * factor;
            autoCarbs += (r.nutritionalInfo.carbs || 0) * factor;
            autoFat += (r.nutritionalInfo.fat || 0) * factor;
            autoFiber += (r.nutritionalInfo.fiber || 0) * factor;
          }
        }
      });
    }

    const recipeData: Omit<Recipe, 'id'> = {
      userId,
      name: recipeName,
      ingredients: finalIngredients,
      isPromo: isPromoMode,
      isIngredient: isIngredientRecipe,
      promoItems: finalPromoItems,
      totalYieldWeight: yieldWeight,
      totalCost,
      costPerGram,
      nutritionalInfo: {
        calories: isPromoMode ? autoCalories : autoCalories + (parseFloat(calories) || 0),
        protein: isPromoMode ? autoProtein : autoProtein + (parseFloat(protein) || 0),
        carbs: isPromoMode ? autoCarbs : autoCarbs + (parseFloat(carbs) || 0),
        fat: isPromoMode ? autoFat : autoFat + (parseFloat(fat) || 0),
        fiber: isPromoMode ? autoFiber : autoFiber + (parseFloat(fiber) || 0),
      },
      ... (isPromoMode ? {} : {
        manualNutritionalInfo: {
          calories: parseFloat(calories) || 0,
          protein: parseFloat(protein) || 0,
          carbs: parseFloat(carbs) || 0,
          fat: parseFloat(fat) || 0,
          fiber: parseFloat(fiber) || 0,
        },
        yieldUnit: yieldUnit as Unit
      }),
      portionWeight: parseFloat(portionWeight) || 0,
      conservation,
      // Catalog fields
      showInCatalog,
      catalogPrice: parseFloat(catalogPrice) || 0,
      catalogDescription,
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
      const container = document.getElementById('calc-modal-content');
      if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

    } catch (err) {
      console.error(err);
      setErrorMsg('Error al guardar. Verifica tu conexión.');
    }
  };

  const handleEdit = (recipe: Recipe) => {
    setRecipeName(recipe.name);
    if (recipe.yieldUnit) {
      setYieldUnit(recipe.yieldUnit);
      if (recipe.yieldUnit === Unit.KG || recipe.yieldUnit === Unit.LT) {
        setTotalYield((recipe.totalYieldWeight / 1000).toString());
      } else {
        setTotalYield(recipe.totalYieldWeight.toString());
      }
    } else {
      // Logic for old recipes
      if (recipe.totalYieldWeight >= 1000 && !recipe.portionWeight) {
        setTotalYield((recipe.totalYieldWeight / 1000).toString());
        setYieldUnit('Kg');
      } else {
        setTotalYield(recipe.totalYieldWeight.toString());
        setYieldUnit(recipe.portionWeight ? 'Un' : 'gr');
      }
    }

    const isPromo = !!recipe.isPromo;
    setIsPromoMode(isPromo);

    if (isPromo) {
      const localPromoItems = (recipe.promoItems || []).map(i => ({
        recipeId: i.recipeId,
        quantityUsed: i.quantityUsed.toString()
      }));
      setPromoItemsList(localPromoItems);
      setIngredientsList([]);
    } else {
      const localIngredients = recipe.ingredients.map(i => {
        let unitUsed = 'gr';
        if (i.type !== 'recipe') {
          const ing = availableIngredients.find(ai => ai.id === i.ingredientId);
          if (ing?.unit === Unit.UN) unitUsed = 'Un';
        } else {
          const subR = savedRecipes.find(sr => sr.id === i.ingredientId);
          if (subR?.portionWeight) unitUsed = 'porción';
        }

        return {
          ingredientId: i.ingredientId,
          type: i.type || 'ingredient',
          quantityUsed: i.quantityUsed.toString(),
          unitUsed
        };
      });
      setIngredientsList(localIngredients);
      setPromoItemsList([]);
    }

    setIsIngredientRecipe(!!recipe.isIngredient);

    // Set nutritional info
    const getManualOrFull = (field: keyof Omit<import('../types').NutritionalInfo, 'id'>) => {
      if (recipe.manualNutritionalInfo && recipe.manualNutritionalInfo[field] !== undefined) {
        return recipe.manualNutritionalInfo[field].toString();
      }
      if (!recipe.isPromo && recipe.nutritionalInfo && recipe.nutritionalInfo[field] !== undefined) {
        return recipe.nutritionalInfo[field].toString();
      }
      return '';
    };

    setCalories(getManualOrFull('calories'));
    setProtein(getManualOrFull('protein'));
    setCarbs(getManualOrFull('carbs'));
    setFat(getManualOrFull('fat'));
    setFiber(getManualOrFull('fiber'));
    setPortionWeight(recipe.portionWeight?.toString() || '');
    setConservation(recipe.conservation || '');

    // Set catalog info
    setShowInCatalog(!!recipe.showInCatalog);
    setCatalogPrice(recipe.catalogPrice?.toString() || '');
    setCatalogDescription(recipe.catalogDescription || '');

    setEditingId(recipe.id);

    // Scroll to form
    const container = document.getElementById('calc-modal-content');
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDuplicate = (recipe: Recipe) => {
    handleEdit(recipe);
    setEditingId(null);
    setRecipeName(`${recipe.name} (Copia)`);
    setViewRecipe(null);
  };

  const handleCopyToClipboard = (recipe: Recipe) => {
    let text = `RECETA: ${recipe.name.toUpperCase()}\n`;
    text += `Rendimiento: ${formatQuantity(recipe.totalYieldWeight, recipe.yieldUnit || (recipe.portionWeight ? Unit.UN : Unit.GR))}\n\n`;
    
    text += `INGREDIENTES:\n`;
    if (recipe.isPromo) {
      (recipe.promoItems || []).forEach(pItem => {
        const fullRecipe = savedRecipes.find(r => r.id === pItem.recipeId);
        text += `- ${fullRecipe?.name || 'Receta eliminada'}: ${formatQuantity(pItem.quantityUsed, fullRecipe?.portionWeight ? Unit.UN : Unit.GR)}\n`;
      });
    } else {
      recipe.ingredients.forEach(ing => {
        let name = 'Eliminado';
        let displayQty = '';
        if (ing.type === 'recipe') {
          const subR = savedRecipes.find(r => r.id === ing.ingredientId);
          if (subR) {
            name = `${subR.name} (Receta)`;
            displayQty = formatQuantity(ing.quantityUsed, subR.portionWeight ? Unit.UN : Unit.GR);
          }
        } else {
          const fullIng = availableIngredients.find(i => i.id === ing.ingredientId);
          if (fullIng) {
            name = fullIng.name;
            displayQty = formatQuantity(ing.quantityUsed, fullIng.unit);
          }
        }
        text += `- ${name}: ${displayQty}\n`;
      });
    }

    if (recipe.nutritionalInfo) {
      text += `\nINFO NUTRICIONAL (TOTAL):\n`;
      text += `Calorías: ${recipe.nutritionalInfo.calories} Kcal\n`;
      text += `Proteínas: ${recipe.nutritionalInfo.protein}g\n`;
      text += `Grasas: ${recipe.nutritionalInfo.fat}g\n`;
      text += `Carbos: ${recipe.nutritionalInfo.carbs}g\n`;
      text += `Fibra: ${recipe.nutritionalInfo.fiber}g\n`;
    }

    if (recipe.portionWeight) text += `\nPorción Sugerida: ${recipe.portionWeight}g\n`;
    if (recipe.conservation) text += `Conservación: ${recipe.conservation}\n`;

    navigator.clipboard.writeText(text).then(() => {
      setSuccessMsg('Receta copiada al portapapeles!');
      setTimeout(() => setSuccessMsg(''), 3000);
    }).catch(err => {
      console.error('Error copying text: ', err);
      alert('Error al copiar al portapapeles');
    });
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
    setPromoItemsList([]);
    setIsPromoMode(false);
    setIsIngredientRecipe(false);
    setTotalYield('');
    setYieldUnit('gr');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setFiber('');
    setPortionWeight('');
    setConservation('');
    setShowInCatalog(false);
    setCatalogPrice('');
    setCatalogDescription('');
    setEditingId(null);
    setErrorMsg('');
  };

  const handleToggleCatalog = async (recipe: Recipe) => {
    try {
      await updateDoc(doc(db, 'recipes', recipe.id), {
        showInCatalog: !recipe.showInCatalog
      });
    } catch (err) {
      console.error('Error toggling catalog:', err);
      alert('Error al cambiar visibilidad del catálogo');
    }
  };

  const getIngredientUnitLabel = (id: string, type?: 'ingredient' | 'recipe') => {
    if (type === 'recipe') {
      const recipe = savedRecipes.find(r => r.id === id);
      return recipe?.portionWeight ? 'porción' : 'gr';
    }
    const ing = availableIngredients.find(i => i.id === id);
    if (!ing) return 'cant';
    switch (ing.unit) {
      case 'Kg': return 'gramos';
      case 'Lt': return 'ml';
      default: return 'unidades';
    }
  };

  const currentTotal = calculateTotalCost();

  const autoNutrients = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
  if (isPromoMode) {
    promoItemsList.forEach(item => {
      const r = savedRecipes.find(rr => rr.id === item.recipeId);
      const qty = parseFloat(item.quantityUsed);
      if (r && r.nutritionalInfo && r.totalYieldWeight && !isNaN(qty) && r.totalYieldWeight > 0) {
        const factor = qty / r.totalYieldWeight;
        autoNutrients.calories += (r.nutritionalInfo.calories || 0) * factor;
        autoNutrients.protein += (r.nutritionalInfo.protein || 0) * factor;
        autoNutrients.carbs += (r.nutritionalInfo.carbs || 0) * factor;
        autoNutrients.fat += (r.nutritionalInfo.fat || 0) * factor;
        autoNutrients.fiber += (r.nutritionalInfo.fiber || 0) * factor;
      }
    });
  } else {
    ingredientsList.forEach(item => {
      if (item.type === 'recipe') {
        const r = savedRecipes.find(rr => rr.id === item.ingredientId);
        const qty = parseFloat(item.quantityUsed);
        if (r && r.nutritionalInfo && r.totalYieldWeight && !isNaN(qty) && r.totalYieldWeight > 0) {
          const factor = qty / r.totalYieldWeight;
          autoNutrients.calories += (r.nutritionalInfo.calories || 0) * factor;
          autoNutrients.protein += (r.nutritionalInfo.protein || 0) * factor;
          autoNutrients.carbs += (r.nutritionalInfo.carbs || 0) * factor;
          autoNutrients.fat += (r.nutritionalInfo.fat || 0) * factor;
          autoNutrients.fiber += (r.nutritionalInfo.fiber || 0) * factor;
        }
      }
    });
  }

  return (
    <div className="space-y-4 sm:space-y-8 animate-fade-in pb-20">

      {/* FORM SECTION */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-brand-brown/10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3 sm:gap-4">
          <h2 className="text-xl font-bold text-brand-brown font-serif">
            {editingId ? (isPromoMode ? 'Editar Promoción' : 'Editar Receta') : (isPromoMode ? 'Nueva Promoción' : 'Nueva Receta')}
          </h2>

          {!editingId && (
            <div className="flex bg-brand-brown/5 rounded-xl p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setIsPromoMode(false)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isPromoMode ? 'bg-white text-brand-brown shadow-sm' : 'text-brand-brown/60 hover:text-brand-brown'}`}
              >
                Receta
              </button>
              <button
                type="button"
                onClick={() => setIsPromoMode(true)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isPromoMode ? 'bg-white text-brand-brown shadow-sm' : 'text-brand-brown/60 hover:text-brand-brown'}`}
              >
                Promoción
              </button>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-brand-brown mb-1">{isPromoMode ? 'Nombre de la Promoción' : 'Nombre de la Receta'}</label>
            <input
              type="text"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-brand-beige/50 placeholder-brand-brown/40"
              placeholder={isPromoMode ? "Ej. Promoción Día de la Madre" : "Ej. Torta de Chocolate Keto"}
              required
            />
          </div>

          {/* Is Ingredient Checkbox */}
          {!isPromoMode && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isIngredientRecipe"
                checked={isIngredientRecipe}
                onChange={(e) => setIsIngredientRecipe(e.target.checked)}
                className="w-4 h-4 text-brand-accent rounded focus:ring-brand-accent/50 border-brand-brown/20"
              />
              <label htmlFor="isIngredientRecipe" className="text-sm font-bold text-brand-brown">
                Esta receta puede usarse como ingrediente en otras recetas
              </label>
            </div>
          )}

          {/* Ingredients or Promo Items */}
          {isPromoMode ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-brand-brown">Recetas de la Promoción</label>
                <button
                  type="button"
                  onClick={addPromoItemRow}
                  className="text-xs bg-brand-brown/10 text-brand-brown px-3 py-1 rounded-full font-bold hover:bg-brand-brown/20 transition-colors"
                >
                  + Agregar
                </button>
              </div>

              {promoItemsList.map((row, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-grow space-y-2 sm:space-y-0 sm:flex sm:gap-1">
                    <select
                      value={row.recipeId}
                      onChange={(e) => handlePromoRowChange(index, 'recipeId', e.target.value)}
                      className="w-full sm:w-2/3 p-2.5 rounded-xl border border-brand-brown/20 bg-brand-beige/50 text-sm text-brand-brown focus:ring-2 focus:ring-brand-accent/50 focus:outline-none"
                      required
                    >
                      <option value="">Seleccionar receta...</option>
                      {savedRecipes.filter(r => !r.isPromo && r.id !== editingId).map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                    <div className="relative w-full sm:w-1/3">
                      <input
                        type="number"
                        value={row.quantityUsed}
                        onChange={(e) => handlePromoRowChange(index, 'quantityUsed', e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-brand-brown/20 text-sm text-brand-brown bg-brand-beige/50 placeholder-brand-brown/40 focus:ring-2 focus:ring-brand-accent/50 focus:outline-none"
                        placeholder="Cantidad a usar (gr/un)"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-brand-brown/60">
                        gr/un
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePromoItemRow(index)}
                    className="mt-1 p-2 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
              {promoItemsList.length === 0 && (
                <p className="text-sm text-brand-brown/40 italic text-center py-2 bg-brand-brown/5 rounded-lg">Agrega recetas a la promoción</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-bold text-brand-brown">Ingredientes</label>
                <button
                  type="button"
                  onClick={addIngredientRow}
                  className="text-xs bg-brand-brown/10 text-brand-brown px-3 py-1 rounded-full font-bold hover:bg-brand-brown/20 transition-colors"
                >
                  + Agregar
                </button>
              </div>

            {ingredientsList.map((row, index) => (
              <div key={index} className="flex gap-2 items-start">
                <div className="flex-grow space-y-2 sm:space-y-0 sm:flex sm:gap-1">
                  <select
                    value={row.ingredientId ? `${row.type || 'ingredient'}-${row.ingredientId}` : ''}
                    onChange={(e) => {
                       const val = e.target.value;
                       if (!val) {
                         const newList = [...ingredientsList];
                         newList[index] = { ...newList[index], ingredientId: '', type: 'ingredient' };
                         setIngredientsList(newList);
                         return;
                       }
                       const [type, ...idParts] = val.split('-');
                       const id = idParts.join('-');
                       const newList = [...ingredientsList];
                       
                       // Set default unit based on ingredient type/unit
                       let defaultUnit = 'gr';
                       if (type === 'ingredient') {
                         const ing = availableIngredients.find(ai => ai.id === id);
                         if (ing?.unit === Unit.UN) defaultUnit = 'Un';
                       } else {
                         const subR = savedRecipes.find(sr => sr.id === id);
                         if (subR?.portionWeight) defaultUnit = 'porción';
                       }

                       newList[index] = { ...newList[index], ingredientId: id, type: type as 'ingredient' | 'recipe', unitUsed: defaultUnit };
                       setIngredientsList(newList);
                    }}
                    className="w-full sm:w-2/3 p-2.5 rounded-xl border border-brand-brown/20 bg-brand-beige/50 text-sm text-brand-brown focus:ring-2 focus:ring-brand-accent/50 focus:outline-none"
                    required
                  >
                    <option value="">Seleccionar ingrediente...</option>
                    <optgroup label="Ingredientes Base">
                      {availableIngredients.map(ing => (
                        <option key={ing.id} value={`ingredient-${ing.id}`}>{ing.name}</option>
                      ))}
                    </optgroup>
                    {savedRecipes.filter(r => r.isIngredient && r.id !== editingId).length > 0 && (
                      <optgroup label="Sub-recetas">
                        {savedRecipes.filter(r => r.isIngredient && r.id !== editingId).map(r => (
                          <option key={r.id} value={`recipe-${r.id}`}>{r.name} (${r.costPerGram.toFixed(4)}/gr)</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <div className="relative w-full sm:w-1/3">
                    <input
                      type="number"
                      value={row.quantityUsed}
                      onChange={(e) => handleRowChange(index, 'quantityUsed', e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-brand-brown/20 text-sm text-brand-brown bg-brand-beige/50 placeholder-brand-brown/40 focus:ring-2 focus:ring-brand-accent/50 focus:outline-none"
                      placeholder="Cantidad usada"
                      required
                    />
                    <select
                      value={row.unitUsed}
                      onChange={(e) => {
                        const newList = [...ingredientsList];
                        newList[index] = { ...newList[index], unitUsed: e.target.value };
                        setIngredientsList(newList);
                      }}
                      className="absolute right-0 top-0 bottom-0 px-2 rounded-r-xl border-l border-brand-brown/20 bg-brand-brown/5 text-xs text-brand-brown font-bold focus:outline-none"
                    >
                      {row.type === 'recipe' ? (
                        <>
                          <option value="gr">gr</option>
                          {savedRecipes.find(r => r.id === row.ingredientId)?.portionWeight && <option value="porción">porción</option>}
                        </>
                      ) : (
                        (() => {
                          const ing = availableIngredients.find(ai => ai.id === row.ingredientId);
                          if (!ing) return <option value="cant">-</option>;
                          if (ing.unit === Unit.UN) return <option value="Un">Un</option>;
                          if (ing.unit === Unit.KG || ing.unit === Unit.GR) return (
                            <>
                              <option value="gr">gr</option>
                              <option value="Kg">Kg</option>
                            </>
                          );
                          if (ing.unit === Unit.LT || ing.unit === Unit.ML) return (
                            <>
                              <option value="ml">ml</option>
                              <option value="Lt">Lt</option>
                            </>
                          );
                          return <option value={ing.unit}>{ing.unit}</option>;
                        })()
                      )}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeIngredientRow(index)}
                  className="mt-1 p-2 text-red-400 hover:text-red-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
            {ingredientsList.length === 0 && (
              <p className="text-sm text-brand-brown/40 italic text-center py-2 bg-brand-brown/5 rounded-lg">Agrega ingredientes a la lista</p>
            )}
          </div>
          )}

          {/* Yield */}
          {!isPromoMode && (
            <div className="bg-brand-brown/5 p-4 rounded-xl border border-brand-brown/10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-brand-brown">Costo Ingredientes:</span>
                <span className="font-bold text-lg text-brand-brown">${currentTotal.toFixed(2)}</span>
              </div>
              <label className="block text-sm font-bold text-brand-brown mb-1">Peso Final de la Preparación (Yield)</label>
              <div className="relative">
                <input
                  type="number"
                  value={totalYield}
                  onChange={(e) => setTotalYield(e.target.value)}
                  className="w-full p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40"
                  placeholder="Total en gramos o unidades"
                  required={!isPromoMode}
                />
                <select
                  value={yieldUnit}
                  onChange={(e) => setYieldUnit(e.target.value)}
                  className="absolute right-0 top-0 bottom-0 px-3 rounded-r-xl border-l border-brand-brown/20 bg-brand-brown/5 text-sm text-brand-brown font-bold focus:outline-none"
                >
                  <option value="gr">gr</option>
                  <option value="Kg">Kg</option>
                  <option value="ml">ml</option>
                  <option value="Lt">Lt</option>
                  <option value="Un">Un</option>
                </select>
              </div>
            </div>
          )}
          {isPromoMode && (
            <div className="bg-brand-brown/5 p-4 rounded-xl border border-brand-brown/10 flex justify-between items-center">
              <span className="text-sm font-bold text-brand-brown">Costo Base de Promo:</span>
              <span className="font-bold text-lg text-brand-brown">${currentTotal.toFixed(2)}</span>
            </div>
          )}

          {/* Nutritional Info Section */}
          {!isPromoMode && (
            <div className="bg-brand-brown/5 p-4 rounded-xl border border-brand-brown/10">
              <h3 className="text-md font-bold text-brand-brown mb-1 font-serif">
                Información Nutricional Adicional
              </h3>
              <p className="text-xs text-brand-brown/70 mb-3 border-b border-brand-brown/10 pb-2">
                Los valores de las sub-recetas utilizadas se suman automáticamente. Ingresa los valores correspondientes <strong>solo</strong> a los ingredientes básicos adicionales.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-brand-brown mb-1">Calorías Extra (Kcal)</label>
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    className="w-full p-2 rounded-lg border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-brown mb-1">Grasas Extra (g)</label>
                  <input
                    type="number"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    className="w-full p-2 rounded-lg border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-brown mb-1">Carbos Extra (g)</label>
                  <input
                    type="number"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    className="w-full p-2 rounded-lg border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-brown mb-1">Proteínas Extra (g)</label>
                  <input
                    type="number"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    className="w-full p-2 rounded-lg border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-brown mb-1">Fibra Extra (g)</label>
                  <input
                    type="number"
                    value={fiber}
                    onChange={(e) => setFiber(e.target.value)}
                    className="w-full p-2 rounded-lg border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Total preview */}
              <div className="bg-white p-3 rounded-lg border border-brand-brown/20 mt-4 mb-4">
                <h4 className="text-sm font-bold text-brand-brown mb-2">Total Calculado (Auto + Manual):</h4>
                <div className="grid grid-cols-5 gap-0 text-center text-xs">
                  <div>
                    <span className="block font-bold">Kcal</span>
                    <span className="text-brand-brown/80">{Math.round(autoNutrients.calories + (parseFloat(calories) || 0))}</span>
                  </div>
                  <div>
                    <span className="block font-bold">Grasas</span>
                    <span className="text-brand-brown/80">{Math.round((autoNutrients.fat + (parseFloat(fat) || 0)) * 10) / 10}g</span>
                  </div>
                  <div>
                    <span className="block font-bold">Carbos</span>
                    <span className="text-brand-brown/80">{Math.round((autoNutrients.carbs + (parseFloat(carbs) || 0)) * 10) / 10}g</span>
                  </div>
                  <div>
                    <span className="block font-bold">Prote</span>
                    <span className="text-brand-brown/80">{Math.round((autoNutrients.protein + (parseFloat(protein) || 0)) * 10) / 10}g</span>
                  </div>
                  <div>
                    <span className="block font-bold">Fibra</span>
                    <span className="text-brand-brown/80">{Math.round((autoNutrients.fiber + (parseFloat(fiber) || 0)) * 10) / 10}g</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-brand-brown mb-1">Peso de 1 Porción (g)</label>
                  <input
                    type="number"
                    value={portionWeight}
                    onChange={(e) => setPortionWeight(e.target.value)}
                    className="w-full p-2 rounded-lg border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40"
                    placeholder="Ej. 60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-brown mb-1">Conservación</label>
                  <input
                    type="text"
                    value={conservation}
                    onChange={(e) => setConservation(e.target.value)}
                    className="w-full p-2 rounded-lg border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40"
                    placeholder="Ej. Heladera: 7 días"
                  />
                </div>
              </div>
            </div>
          )}

          {isPromoMode && (
            <div className="bg-brand-brown/5 p-4 rounded-xl border border-brand-brown/10">
              <h3 className="text-md font-bold text-brand-brown mb-3 font-serif border-b border-brand-brown/10 pb-2">
                Información Nutricional (Calculada Automáticamente)
              </h3>
              <div className="bg-white p-3 rounded-lg border border-brand-brown/20 mt-2 mb-2">
                <div className="grid grid-cols-5 gap-0 text-center text-xs">
                  <div>
                    <span className="block font-bold">Kcal</span>
                    <span className="text-brand-brown/80">{Math.round(autoNutrients.calories)}</span>
                  </div>
                  <div>
                    <span className="block font-bold">Grasas</span>
                    <span className="text-brand-brown/80">{Math.round(autoNutrients.fat * 10) / 10}g</span>
                  </div>
                  <div>
                    <span className="block font-bold">Carbos</span>
                    <span className="text-brand-brown/80">{Math.round(autoNutrients.carbs * 10) / 10}g</span>
                  </div>
                  <div>
                    <span className="block font-bold">Prote</span>
                    <span className="text-brand-brown/80">{Math.round(autoNutrients.protein * 10) / 10}g</span>
                  </div>
                  <div>
                    <span className="block font-bold">Fibra</span>
                    <span className="text-brand-brown/80">{Math.round(autoNutrients.fiber * 10) / 10}g</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Catalog Settings */}
          <div className="bg-gradient-to-r from-brand-accent/10 to-brand-accent/5 p-4 rounded-xl border border-brand-accent/20">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="showInCatalog"
                checked={showInCatalog}
                onChange={(e) => setShowInCatalog(e.target.checked)}
                className="w-5 h-5 text-brand-accent rounded focus:ring-brand-accent/50 border-brand-brown/20"
              />
              <label htmlFor="showInCatalog" className="text-sm font-bold text-brand-brown flex items-center gap-2">
                <span>🛒</span> Publicar en Catálogo para Clientes
              </label>
            </div>

            {showInCatalog && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 pl-8">
                <div>
                  <label className="block text-xs font-bold text-brand-brown mb-1">Precio de Venta ($)</label>
                  <input
                    type="number"
                    value={catalogPrice}
                    onChange={(e) => setCatalogPrice(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40 font-bold text-lg"
                    placeholder="Ej. 5500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-brown mb-1">Descripción para Cliente</label>
                  <input
                    type="text"
                    value={catalogDescription}
                    onChange={(e) => setCatalogDescription(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-brand-brown bg-white placeholder-brand-brown/40"
                    placeholder="Ej. Torta húmeda de chocolate sin azúcar"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-brand-brown text-white py-4 rounded-xl font-bold hover:bg-[#4A2E21] transition shadow-lg text-lg font-serif"
            >
              {editingId ? 'Actualizar Receta' : 'Guardar Receta'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-4 bg-brand-brown/10 text-brand-brown rounded-xl font-bold hover:bg-brand-brown/20 transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div >

      {/* LIST SECTION */}
      < div className="space-y-4" >
        <h3 className="text-lg font-bold text-brand-brown pl-2 border-l-4 border-brand-brown font-serif">
          Mis Recetas ({savedRecipes.length})
        </h3>

        {
          savedRecipes.length === 0 ? (
            <p className="text-center text-brand-brown/40 py-8 italic">No tienes recetas guardadas aún.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedRecipes.map(recipe => (
                <div key={recipe.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${recipe.showInCatalog ? 'border-green-300' : 'border-brand-brown/10'} flex flex-col justify-between hover:border-brand-brown/30 transition-all`}>
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-lg text-brand-brown leading-tight font-serif">{recipe.name}</h4>
                        {recipe.showInCatalog && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full mt-1">
                            🛒 En Catálogo · ${recipe.catalogPrice?.toLocaleString() || '0'}
                          </span>
                        )}
                      </div>
                      <span className="bg-brand-brown/10 text-brand-brown text-xs font-bold px-2 py-1 rounded-lg ml-2 whitespace-nowrap">
                        {recipe.isPromo ? `${recipe.promoItems?.length || 0} Sub-recetas` : `${recipe.ingredients.length} Ingred.`}
                      </span>
                    </div>

                    <div className="space-y-1 text-sm text-brand-brown/70 mb-4">
                      {!recipe.isPromo && (
                        <p className="flex justify-between">
                          <span>Rendimiento (Yield):</span>
                          <span className="font-medium text-brand-brown">{formatQuantity(recipe.totalYieldWeight, recipe.yieldUnit || (recipe.portionWeight ? Unit.UN : Unit.GR))}</span>
                        </p>
                      )}
                      <p className="flex justify-between">
                        <span>Costo Total:</span>
                        <span className="font-medium text-brand-brown">${recipe.totalCost.toFixed(2)}</span>
                      </p>
                      {!recipe.isPromo && (
                        <div className="pt-2 mt-2 border-t border-brand-brown/10 flex justify-between text-brand-brown font-bold">
                          <span>Costo Base:</span>
                          <span>${recipe.costPerGram.toFixed(4)} / gr</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-2 pt-3 border-t border-brand-brown/5">
                    <button
                      type="button"
                      onClick={() => setViewRecipe(recipe)}
                      className="flex-1 py-2 text-sm font-semibold text-brand-brown bg-brand-accent/20 rounded-lg hover:bg-brand-accent/40 transition flex justify-center items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Ver
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEdit(recipe)}
                      className="flex-1 py-2 text-sm font-semibold text-brand-brown bg-brand-brown/5 rounded-lg hover:bg-brand-brown/10 transition flex justify-center items-center gap-2"
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
          )
        }
      </div >

      {/* VIEW RECIPE MODAL */}
      {viewRecipe && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] overflow-y-auto rounded-3xl shadow-2xl p-5 sm:p-6 relative animate-in zoom-in-95 duration-200 border border-brand-brown/10 custom-scrollbar">

            <button
              onClick={() => setViewRecipe(null)}
              className="absolute top-4 right-4 p-2 bg-brand-brown/5 rounded-full hover:bg-brand-brown/10 text-brand-brown transition-colors z-10"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex justify-center items-center gap-2 mb-6 pr-8">
              <h2 className="text-2xl font-serif font-bold text-center text-brand-brown">
                {viewRecipe.name}
              </h2>
              <button
                onClick={() => handleDuplicate(viewRecipe)}
                className="p-1.5 bg-brand-accent/20 rounded-lg hover:bg-brand-accent/40 text-brand-brown transition-colors group flex items-center gap-1.5"
                title="Duplicar receta"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Duplicar</span>
              </button>
              <button
                onClick={() => handleCopyToClipboard(viewRecipe)}
                className="p-1.5 bg-brand-brown/10 rounded-lg hover:bg-brand-brown/20 text-brand-brown transition-colors group flex items-center gap-1.5"
                title="Copiar texto para Docs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Copiar Texto</span>
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className={`grid ${viewRecipe.isPromo ? 'grid-cols-1' : 'grid-cols-3'} gap-3 mb-6`}>
              {!viewRecipe.isPromo && (
                <div className="bg-brand-beige/30 p-3 rounded-xl border border-brand-brown/5 text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-brown/60 mb-1">Rendimiento</span>
                  <span className="block font-bold text-brand-brown text-lg">{formatQuantity(viewRecipe.totalYieldWeight, viewRecipe.yieldUnit || (viewRecipe.portionWeight ? Unit.UN : Unit.GR))}</span>
                </div>
              )}
              <div className="bg-brand-beige/30 p-3 rounded-xl border border-brand-brown/5 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-brown/60 mb-1">Costo Total Promoción</span>
                <span className="block font-bold text-brand-brown text-lg">${viewRecipe.totalCost.toFixed(0)}</span>
              </div>
              {!viewRecipe.isPromo && (
                <div className="bg-brand-beige/30 p-3 rounded-xl border border-brand-brown/5 text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-brown/60 mb-1">Costo/g</span>
                  <span className="block font-bold text-brand-brown text-lg">${viewRecipe.costPerGram.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Ingredients List */}
            <div className="mb-6">
              <h3 className="font-bold text-brand-brown mb-3 flex items-center gap-2 text-sm uppercase tracking-wide opacity-80 border-b border-brand-brown/10 pb-1">
                {viewRecipe.isPromo ? 'Recetas que la componen' : 'Ingredientes'}
              </h3>
              <div className="space-y-2 bg-brand-brown/5 p-4 rounded-xl">
                {viewRecipe.isPromo ? (
                  viewRecipe.promoItems?.map((pItem, idx) => {
                    const fullRecipe = savedRecipes.find(r => r.id === pItem.recipeId);
                    return (
                      <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-brand-brown/10 last:border-0 pb-2 last:pb-0 mb-2 last:mb-0">
                        <span className="font-medium text-brand-brown">{fullRecipe?.name || 'Receta eliminada'}</span>
                        <div className="text-right flex flex-col items-end">
                          <span className="font-bold text-brand-brown">{formatQuantity(pItem.quantityUsed, fullRecipe?.portionWeight ? Unit.UN : Unit.GR)}</span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  viewRecipe.ingredients.map((ing, idx) => {
                    let name = 'Eliminado';
                    let displayQty = '';
                    if (ing.type === 'recipe') {
                      const recipe = savedRecipes.find(r => r.id === ing.ingredientId);
                      if (recipe) {
                        name = `${recipe.name} (Receta)`;
                        displayQty = formatQuantity(ing.quantityUsed, recipe.portionWeight ? Unit.UN : Unit.GR);
                      }
                    } else {
                      const fullIng = availableIngredients.find(i => i.id === ing.ingredientId);
                      if (fullIng) {
                        name = fullIng.name;
                        displayQty = formatQuantity(ing.quantityUsed, fullIng.unit);
                      }
                    }
                    return (
                      <div key={idx} className="flex justify-between items-center text-sm border-b border-dashed border-brand-brown/10 last:border-0 pb-2 last:pb-0 mb-2 last:mb-0">
                        <span className="font-medium text-brand-brown">{name}</span>
                        <div className="text-right flex flex-col items-end">
                          <span className="font-bold text-brand-brown">{displayQty}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Nutritional Info */}
            <div className="mb-6">
              <h3 className="font-bold text-brand-brown mb-3 flex items-center gap-2 text-sm uppercase tracking-wide opacity-80 border-b border-brand-brown/10 pb-1">
                Info. Nutricional (Total)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="flex flex-col p-2 bg-white border border-brand-brown/10 rounded-lg shadow-sm">
                  <span className="text-[9px] font-bold text-brand-brown/60 uppercase">Kcal</span>
                  <span className="font-bold text-brand-brown">{viewRecipe.nutritionalInfo?.calories || 0}</span>
                </div>
                <div className="flex flex-col p-2 bg-white border border-brand-brown/10 rounded-lg shadow-sm">
                  <span className="text-[9px] font-bold text-brand-brown/60 uppercase">Prot</span>
                  <span className="font-bold text-brand-brown">{viewRecipe.nutritionalInfo?.protein || 0}</span>
                </div>
                <div className="flex flex-col p-2 bg-white border border-brand-brown/10 rounded-lg shadow-sm">
                  <span className="text-[9px] font-bold text-brand-brown/60 uppercase">Grasa</span>
                  <span className="font-bold text-brand-brown">{viewRecipe.nutritionalInfo?.fat || 0}</span>
                </div>
                <div className="flex flex-col p-2 bg-white border border-brand-brown/10 rounded-lg shadow-sm">
                  <span className="text-[9px] font-bold text-brand-brown/60 uppercase">Carb</span>
                  <span className="font-bold text-brand-brown">{viewRecipe.nutritionalInfo?.carbs || 0}</span>
                </div>
                <div className="flex flex-col p-2 bg-white border border-brand-brown/10 rounded-lg shadow-sm sm:col-span-1 col-span-2">
                  <span className="text-[9px] font-bold text-brand-brown/60 uppercase">Fibra</span>
                  <span className="font-bold text-brand-brown">{viewRecipe.nutritionalInfo?.fiber || 0}</span>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="font-bold text-brand-brown mb-1 text-xs uppercase tracking-wide opacity-80">Porción Sugerida</h3>
                <p className="p-3 bg-brand-brown/5 rounded-lg text-brand-brown font-medium text-sm border border-brand-brown/10">
                  {viewRecipe.portionWeight ? `${viewRecipe.portionWeight} g` : 'No especificada'}
                </p>
              </div>
              <div>
                <h3 className="font-bold text-brand-brown mb-1 text-xs uppercase tracking-wide opacity-80">Conservación</h3>
                <p className="p-3 bg-brand-brown/5 rounded-lg text-brand-brown font-medium text-sm border border-brand-brown/10">
                  {viewRecipe.conservation || 'No especificada'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setViewRecipe(null)}
              className="w-full py-3.5 bg-brand-brown text-white font-bold rounded-xl shadow-lg hover:bg-black transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>,
        document.body
      )}

      {successMsg && (
        <div className="fixed bottom-20 md:bottom-10 left-4 right-4 bg-brand-brown text-white p-4 rounded-xl text-center shadow-lg animate-bounce z-50 font-serif">
          {successMsg}
        </div>
      )}
    </div >
  );
};

export default Recipes;
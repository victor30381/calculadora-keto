import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { collection, addDoc, query, where, onSnapshot, QuerySnapshot, DocumentData, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
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
  const [isGeneratingNutrition, setIsGeneratingNutrition] = useState(false);
  const [recipeSearchTerm, setRecipeSearchTerm] = useState('');

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

  const handleGenerateNutrition = async () => {
    if (!recipeName || ingredientsList.length === 0) {
      alert("Por favor, ingresa el nombre de la receta y al menos un ingrediente antes de usar la IA.");
      return;
    }

    setIsGeneratingNutrition(true);
    try {
      let ingredientsText = "";
      ingredientsList.forEach((ing) => {
        let name = "Desconocido";
        let displayQty = "";
        
        if (ing.type === 'recipe') {
          const recipe = savedRecipes.find(r => r.id === ing.ingredientId);
          if (recipe) {
            name = recipe.name;
            displayQty = formatQuantity(ing.quantityUsed, recipe.portionWeight ? Unit.UN : Unit.GR);
          }
        } else {
          const fullIng = availableIngredients.find(i => i.id === ing.ingredientId);
          if (fullIng) {
            name = fullIng.name;
            displayQty = formatQuantity(ing.quantityUsed, fullIng.unit);
          }
        }
        ingredientsText += `- ${name}: ${displayQty}\n`;
      });

      const generateNutrition = httpsCallable(functions, "generateNutrition");
      
      const response = await generateNutrition({
        recipeName: recipeName,
        ingredientsText: ingredientsText,
      });

      const data = response.data as { calories: number; protein: number; carbs: number; fat: number; fiber: number };
      
      setCalories(data.calories?.toString() || "0");
      setProtein(data.protein?.toString() || "0");
      setCarbs(data.carbs?.toString() || "0");
      setFat(data.fat?.toString() || "0");
      setFiber(data.fiber?.toString() || "0");
      
      setSuccessMsg("¡Valores nutricionales calculados con IA!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (error: any) {
      console.error("Error generating nutrition:", error);
      alert("Hubo un error al calcular con IA: " + error.message);
    } finally {
      setIsGeneratingNutrition(false);
    }
  };

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
    <div className="space-y-5 sm:space-y-8 animate-fade-in pb-20">

      {/* FORM SECTION */}
      <div className="bg-white rounded-2xl shadow-lg border border-brand-brown/8 overflow-hidden">
        {/* Form Header with gradient accent */}
        <div className="relative px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
          <div className="absolute top-0 left-0 right-0 h-1 warm-gradient-accent opacity-60"></div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl warm-gradient-brown flex items-center justify-center shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isPromoMode ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  )}
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-brand-brown font-serif leading-tight">
                  {editingId ? (isPromoMode ? 'Editar Promoción' : 'Editar Receta') : (isPromoMode ? 'Nueva Promoción' : 'Nueva Receta')}
                </h2>
                <p className="text-[11px] text-brand-brown/50 mt-0.5">{isPromoMode ? 'Combina recetas en una oferta especial' : 'Calcula costos e información nutricional'}</p>
              </div>
            </div>

            {!editingId && (
              <div className="flex bg-brand-brown/5 rounded-xl p-1 shadow-inner border border-brand-brown/5">
                <button
                  type="button"
                  onClick={() => setIsPromoMode(false)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${!isPromoMode ? 'bg-white text-brand-brown shadow-md' : 'text-brand-brown/50 hover:text-brand-brown'}`}
                >
                  Receta
                </button>
                <button
                  type="button"
                  onClick={() => setIsPromoMode(true)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${isPromoMode ? 'bg-white text-brand-brown shadow-md' : 'text-brand-brown/50 hover:text-brand-brown'}`}
                >
                  Promoción
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 sm:px-6 pb-5 sm:pb-6">
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-xl mb-4 text-sm flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-brand-brown/70 uppercase tracking-wider mb-1.5">{isPromoMode ? 'Nombre de la Promoción' : 'Nombre de la Receta'}</label>
            <input
              type="text"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-brand-brown/15 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 focus:border-brand-accent/30 text-brand-brown bg-brand-cream/50 placeholder-brand-brown/30 text-base font-medium transition-all input-premium"
              placeholder={isPromoMode ? "Ej. Promoción Día de la Madre" : "Ej. Torta de Chocolate Keto"}
              required
            />
          </div>

          {/* Is Ingredient Toggle */}
          {!isPromoMode && (
            <label htmlFor="isIngredientRecipe" className="flex items-center gap-3 p-3 rounded-xl bg-brand-accent/5 border border-brand-accent/10 cursor-pointer hover:bg-brand-accent/10 transition-colors group">
              <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${isIngredientRecipe ? 'bg-brand-accent' : 'bg-brand-brown/20'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${isIngredientRecipe ? 'translate-x-4' : 'translate-x-0'}`}></div>
                <input
                  type="checkbox"
                  id="isIngredientRecipe"
                  checked={isIngredientRecipe}
                  onChange={(e) => setIsIngredientRecipe(e.target.checked)}
                  className="sr-only"
                />
              </div>
              <div>
                <span className="text-sm font-semibold text-brand-brown block leading-tight">Usar como sub-ingrediente</span>
                <span className="text-[11px] text-brand-brown/50">Permitir usar esta receta dentro de otras recetas</span>
              </div>
            </label>
          )}

          {/* Ingredients or Promo Items */}
          {isPromoMode ? (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-brand-accent/15 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  </div>
                  <label className="block text-xs font-bold text-brand-brown/70 uppercase tracking-wider">Recetas de la Promoción</label>
                </div>
                <button
                  type="button"
                  onClick={addPromoItemRow}
                  className="text-xs bg-brand-brown text-white px-3.5 py-1.5 rounded-lg font-bold hover:bg-brand-brown/90 transition-all shadow-sm hover:shadow-md"
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
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-brand-accent/15 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                  </div>
                  <label className="block text-xs font-bold text-brand-brown/70 uppercase tracking-wider">Ingredientes</label>
                </div>
                <button
                  type="button"
                  onClick={addIngredientRow}
                  className="text-xs bg-brand-brown text-white px-3.5 py-1.5 rounded-lg font-bold hover:bg-brand-brown/90 transition-all shadow-sm hover:shadow-md"
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
            <div className="bg-gradient-to-br from-brand-brown/5 to-brand-accent/5 p-5 rounded-2xl border border-brand-brown/10 space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg warm-gradient-accent flex items-center justify-center shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <span className="text-sm font-bold text-brand-brown">Costo Ingredientes</span>
                </div>
                <span className="font-bold text-xl text-brand-brown font-serif">${currentTotal.toFixed(2)}</span>
              </div>
              <div>
                <label className="block text-xs font-bold text-brand-brown/60 uppercase tracking-wider mb-1.5">Peso Final de la Preparación (Yield)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={totalYield}
                    onChange={(e) => setTotalYield(e.target.value)}
                    className="w-full p-3 rounded-xl border border-brand-brown/15 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 text-brand-brown bg-white placeholder-brand-brown/30 input-premium transition-all"
                    placeholder="Total (Ej. 1000)"
                    required={!isPromoMode}
                  />
                  <select
                    value={yieldUnit}
                    onChange={(e) => setYieldUnit(e.target.value)}
                    className="absolute right-0 top-0 bottom-0 px-3 rounded-r-xl border-l border-brand-brown/15 bg-brand-brown/5 text-sm text-brand-brown font-bold focus:outline-none"
                  >
                    <option value="gr">gr</option>
                    <option value="Kg">Kg</option>
                    <option value="ml">ml</option>
                    <option value="Lt">Lt</option>
                    <option value="Un">Un</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          {isPromoMode && (
            <div className="bg-gradient-to-br from-brand-brown/5 to-brand-accent/5 p-5 rounded-2xl border border-brand-brown/10 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg warm-gradient-accent flex items-center justify-center shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="text-sm font-bold text-brand-brown">Costo Base de Promo</span>
              </div>
              <span className="font-bold text-xl text-brand-brown font-serif">${currentTotal.toFixed(2)}</span>
            </div>
          )}

          {/* Nutritional Info Section */}
          {!isPromoMode && (
            <div className="bg-gradient-to-br from-brand-beige/60 to-white p-5 rounded-2xl border border-brand-brown/10 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-brand-brown/8 justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-brand-brown leading-tight">Información Nutricional</h3>
                    <p className="text-[10px] text-brand-brown/50">Sub-recetas se suman automáticamente. Ingresa solo valores adicionales.</p>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={handleGenerateNutrition}
                  disabled={isGeneratingNutrition || !recipeName || ingredientsList.length === 0}
                  className="hidden sm:flex text-xs bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold hover:shadow-md transition-all items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingNutrition ? (
                    <span className="flex items-center gap-1.5">
                      <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      Calculando...
                    </span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                      </svg>
                      Auto-Completar IA ✨
                    </>
                  )}
                </button>
              </div>

              {/* Mobile button */}
              <button
                type="button"
                onClick={handleGenerateNutrition}
                disabled={isGeneratingNutrition || !recipeName || ingredientsList.length === 0}
                className="sm:hidden w-full flex text-xs bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-3 py-2 rounded-lg font-bold hover:shadow-md transition-all justify-center items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed mb-2"
              >
                {isGeneratingNutrition ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Calculando...
                  </span>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                    Auto-Completar con IA ✨
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-brand-brown/60 uppercase tracking-wider mb-1">Calorías (Kcal)</label>
                  <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-brand-brown/12 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-brand-brown bg-white placeholder-brand-brown/25 text-sm input-premium transition-all" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-brown/60 uppercase tracking-wider mb-1">Grasas (g)</label>
                  <input type="number" value={fat} onChange={(e) => setFat(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-brand-brown/12 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-brand-brown bg-white placeholder-brand-brown/25 text-sm input-premium transition-all" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-brown/60 uppercase tracking-wider mb-1">Carbos (g)</label>
                  <input type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-brand-brown/12 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-brand-brown bg-white placeholder-brand-brown/25 text-sm input-premium transition-all" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-brown/60 uppercase tracking-wider mb-1">Proteínas (g)</label>
                  <input type="number" value={protein} onChange={(e) => setProtein(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-brand-brown/12 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-brand-brown bg-white placeholder-brand-brown/25 text-sm input-premium transition-all" placeholder="0" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-brown/60 uppercase tracking-wider mb-1">Fibra (g)</label>
                  <input type="number" value={fiber} onChange={(e) => setFiber(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-brand-brown/12 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-brand-brown bg-white placeholder-brand-brown/25 text-sm input-premium transition-all" placeholder="0" />
                </div>
              </div>

              {/* Total preview */}
              <div className="bg-white p-4 rounded-xl border border-brand-brown/10 shadow-sm">
                <h4 className="text-[10px] font-bold text-brand-brown/60 uppercase tracking-wider mb-3">Total Calculado (Auto + Manual)</h4>
                <div className="grid grid-cols-5 gap-1 sm:gap-2 text-center">
                  <div className="bg-orange-50 rounded-lg p-1 sm:p-2 border border-orange-100">
                    <span className="block text-[8px] sm:text-[9px] font-bold text-orange-600/80 uppercase">Kcal</span>
                    <span className="font-bold text-brand-brown text-xs sm:text-sm">{Math.round(autoNutrients.calories + (parseFloat(calories) || 0))}</span>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-1 sm:p-2 border border-amber-100">
                    <span className="block text-[8px] sm:text-[9px] font-bold text-amber-600/80 uppercase">Grasas</span>
                    <span className="font-bold text-brand-brown text-xs sm:text-sm">{Math.round((autoNutrients.fat + (parseFloat(fat) || 0)) * 10) / 10}g</span>
                  </div>
                  <div className="bg-sky-50 rounded-lg p-1 sm:p-2 border border-sky-100">
                    <span className="block text-[8px] sm:text-[9px] font-bold text-sky-600/80 uppercase">Carbos</span>
                    <span className="font-bold text-brand-brown text-xs sm:text-sm">{Math.round((autoNutrients.carbs + (parseFloat(carbs) || 0)) * 10) / 10}g</span>
                  </div>
                  <div className="bg-rose-50 rounded-lg p-1 sm:p-2 border border-rose-100">
                    <span className="block text-[8px] sm:text-[9px] font-bold text-rose-600/80 uppercase">Prote</span>
                    <span className="font-bold text-brand-brown text-xs sm:text-sm">{Math.round((autoNutrients.protein + (parseFloat(protein) || 0)) * 10) / 10}g</span>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-1 sm:p-2 border border-emerald-100">
                    <span className="block text-[8px] sm:text-[9px] font-bold text-emerald-600/80 uppercase">Fibra</span>
                    <span className="font-bold text-brand-brown text-xs sm:text-sm">{Math.round((autoNutrients.fiber + (parseFloat(fiber) || 0)) * 10) / 10}g</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-brand-brown/60 uppercase tracking-wider mb-1">Peso de 1 Porción (g)</label>
                  <input type="number" value={portionWeight} onChange={(e) => setPortionWeight(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-brand-brown/12 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-brand-brown bg-white placeholder-brand-brown/25 text-sm input-premium transition-all" placeholder="Ej. 60" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-brown/60 uppercase tracking-wider mb-1">Conservación</label>
                  <input type="text" value={conservation} onChange={(e) => setConservation(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-brand-brown/12 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 text-brand-brown bg-white placeholder-brand-brown/25 text-sm input-premium transition-all" placeholder="Ej. Heladera: 7 días" />
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

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="flex-1 warm-gradient-brown text-white py-4 rounded-xl font-bold hover:opacity-90 transition-all shadow-lg hover:shadow-xl text-lg font-serif btn-glow"
            >
              {editingId ? '✓ Actualizar Receta' : '✓ Guardar Receta'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-4 bg-brand-brown/5 text-brand-brown rounded-xl font-bold hover:bg-brand-brown/10 transition-all border border-brand-brown/10"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
        </div>
      </div >

      {/* LIST SECTION */}
      < div className="space-y-4" >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl warm-gradient-brown flex items-center justify-center shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <h3 className="text-lg font-bold text-brand-brown font-serif">
            Mis Recetas <span className="text-brand-brown/40 font-sans text-sm font-normal">({savedRecipes.length})</span>
          </h3>
        </div>

        {/* Search Field */}
        {savedRecipes.length > 0 && (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-brown/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={recipeSearchTerm}
              onChange={(e) => setRecipeSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-brand-brown/15 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 text-brand-brown bg-brand-beige/30 placeholder-brand-brown/35 text-sm transition-all"
              placeholder="Buscar receta..."
            />
            {recipeSearchTerm && (
              <button
                onClick={() => setRecipeSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-brown/40 hover:text-brand-brown transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {
          savedRecipes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-brand-brown/15">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-brand-brown/20 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              <p className="text-brand-brown/40 italic">No tienes recetas guardadas aún.</p>
              <p className="text-brand-brown/30 text-sm mt-1">Crea tu primera receta arriba ☝️</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedRecipes.filter(r => r.name.toLowerCase().includes(recipeSearchTerm.toLowerCase())).length === 0 && recipeSearchTerm ? (
                <div className="col-span-full text-center py-8">
                  <p className="text-brand-brown/40 italic text-sm">No se encontraron recetas para "{recipeSearchTerm}"</p>
                </div>
              ) : (
              savedRecipes.filter(r => r.name.toLowerCase().includes(recipeSearchTerm.toLowerCase())).map(recipe => (
                <div key={recipe.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${recipe.showInCatalog ? 'border-green-300/60 shadow-green-100/50' : 'border-brand-brown/8'} flex flex-col justify-between card-hover-lift`}>
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
            )))}
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
        <div className="fixed bottom-20 md:bottom-10 left-1/2 -translate-x-1/2 warm-gradient-brown text-white px-6 py-4 rounded-2xl text-center shadow-2xl animate-fade-in-up z-50 font-serif flex items-center gap-2 max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {successMsg}
        </div>
      )}
    </div >
  );
};

export default Recipes;
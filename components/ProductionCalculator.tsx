import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { Recipe, Ingredient, formatQuantity, Unit } from '../types';
import jsPDF from 'jspdf';

interface Props {
  userId: string;
}

const ProductionCalculator: React.FC<Props> = ({ userId }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [targetYield, setTargetYield] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'recipes'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
        data.sort((a, b) => a.name.localeCompare(b.name));
        setRecipes(data);
        setErrorMsg('');
      },
      (err) => {
        console.error("Firestore Error:", err);
        setErrorMsg("Error al cargar recetas. Verifica permisos de Firebase.");
      }
    );
    return () => unsubscribe();
  }, [userId]);

  useEffect(() => {
    const q = query(collection(db, 'ingredients'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient));
        setIngredients(data);
      },
      (err) => console.error("Firestore Error for ingredients:", err)
    );
    return () => unsubscribe();
  }, [userId]);

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);
  const target = parseFloat(targetYield) || 0;
  
  // En base a totalYieldWeight (que puede estar en gr o un) vemos el factor
  const yieldUnit = selectedRecipe?.yieldUnit || (selectedRecipe?.portionWeight ? Unit.UN : Unit.GR);
  const totalYieldWeight = selectedRecipe?.totalYieldWeight || 0;

  const factor = totalYieldWeight > 0 ? target / totalYieldWeight : 0;

  const getIngredientDetails = (ing: any) => {
    if (ing.type === 'recipe') {
      const subR = recipes.find(r => r.id === ing.ingredientId);
      if (subR) {
        return {
          name: `${subR.name} (Sub-receta)`,
          baseUnit: subR.portionWeight ? Unit.UN : Unit.GR 
        };
      }
    } else {
      const fullIng = ingredients.find(i => i.id === ing.ingredientId);
      if (fullIng) {
        return {
          name: fullIng.name,
          baseUnit: fullIng.unit
        };
      }
    }
    return { name: 'Desconocido', baseUnit: Unit.GR };
  }

  const generateProductionPDF = () => {
    if (!selectedRecipe || factor <= 0) return;

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const drawContent = (withLogo: boolean, img?: HTMLImageElement) => {
        // TOP HEADER BACKGROUND
        doc.setFillColor(44, 24, 16); // #2C1810 (brand-brown)
        doc.rect(0, 0, 210, 45, 'F');
        
        let startX = 20;

        // Draw Logo if available
        if (withLogo && img) {
          doc.addImage(img, 'PNG', 15, 7, 30, 30, undefined, 'FAST');
          startX = 55;
        }

        // HEADER TEXT
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        const titleText = doc.splitTextToSize(`RECETA: ${selectedRecipe.name.toUpperCase()}`, 140);
        doc.text(titleText, startX, 22);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(200, 200, 200); // Light gray
        doc.text("Plan de Producción y Escalamiento", startX, 24 + (titleText.length * 8));

        // PRODUCTION AMOUNT BADGE
        doc.setFillColor(245, 240, 235); // brand-beige-ish light
        doc.roundedRect(20, 55, 170, 20, 3, 3, 'F');
        doc.setTextColor(44, 24, 16);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text("PRODUCCIÓN OBJETIVO:", 25, 68);
        
        doc.setFontSize(18);
        doc.setTextColor(180, 80, 30); // Accent tone
        doc.text(`${formatQuantity(target, yieldUnit)}`, 185, 69, { align: 'right' });

        // INGREDIENTS TITLE
        doc.setTextColor(44, 24, 16);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text("MATERIA PRIMA NECESARIA", 20, 95);

        doc.setDrawColor(44, 24, 16);
        doc.setLineWidth(0.5);
        doc.line(20, 99, 190, 99);

        // TABLE HEADER
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        doc.text("INGREDIENTE / SUB-RECETA", 22, 106);
        doc.text("CANTIDAD REQUERIDA", 188, 106, { align: 'right' });

        doc.setDrawColor(220, 220, 220);
        doc.line(20, 109, 190, 109);

        // LIST INGREDIENTS
        let currentY = 117;
        doc.setFontSize(12);

        selectedRecipe.ingredients.forEach((ing, index) => {
          if (currentY > 270) {
             doc.addPage();
             currentY = 20;
          }

          const details = getIngredientDetails(ing);
          const needed = ing.quantityUsed * factor;
          
          if (index % 2 === 0) {
            doc.setFillColor(252, 250, 248);
            doc.rect(20, currentY - 6, 170, 10, 'F');
          }

          doc.setTextColor(44, 24, 16);
          doc.setFont('helvetica', 'bold');
          doc.text(details.name, 22, currentY);
          
          doc.setFont('helvetica', 'normal');
          doc.text(`${formatQuantity(needed, details.baseUnit)}`, 188, currentY, { align: 'right' });
          
          currentY += 10;
        });

        // FOOTER
        const pageHeight = doc.internal.pageSize.height;
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(9);
        doc.text("Generado por Alternativa Keto - Calculadora Maestra", 105, pageHeight - 10, { align: 'center' });

        const cleanName = selectedRecipe.name.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`Produccion_${cleanName}_${target}.pdf`);
      };

      const img = new Image();
      const logoPath = `${import.meta.env.BASE_URL}logo.png`;
      img.src = logoPath;
      
      img.onload = () => {
        drawContent(true, img);
      };
      
      img.onerror = () => {
        drawContent(false);
      };

    } catch (err) {
      console.error("Error generating PDF:", err);
      alert("Error al generar el PDF.");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-brand-brown/10">
        <h2 className="text-xl font-bold text-brand-brown mb-4 sm:mb-6 font-serif">Proporciones y Producción</h2>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-brand-brown mb-1">Seleccionar Receta</label>
            <select
              value={selectedRecipeId}
              onChange={(e) => {
                 setSelectedRecipeId(e.target.value);
                 setTargetYield(''); // Reset target yield when changing recipe
              }}
              className="w-full p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 bg-brand-beige/50 text-brand-brown cursor-pointer"
            >
              <option value="">-- Elige una preparación --</option>
              {recipes.filter(r => !r.isPromo).map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="opacity-100 transition-opacity duration-300">
            <label className="block text-sm font-bold text-brand-brown mb-1">
              Cantidad a Producir ({selectedRecipe ? (yieldUnit === Unit.KG ? 'Kg' : (yieldUnit === Unit.LT ? 'Lt' : yieldUnit)) : '...'})
            </label>
            <input
              type="number"
              value={targetYield}
              onChange={(e) => setTargetYield(e.target.value)}
              disabled={!selectedRecipeId}
              className="w-full p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-lg font-semibold bg-brand-beige/50 disabled:bg-gray-100 text-brand-brown placeholder-brand-brown/40"
              placeholder="0"
              min="0"
              step="any"
            />
            {selectedRecipe && totalYieldWeight > 0 && (
                <p className="text-sm mt-2 text-brand-brown/70 font-medium bg-brand-brown/5 inline-block px-3 py-1 rounded-full">
                    La receta original rinde <span className="font-bold">{formatQuantity(totalYieldWeight, yieldUnit)}</span>
                </p>
            )}
            {selectedRecipe && (!totalYieldWeight || totalYieldWeight <= 0) && (
                 <p className="text-sm mt-2 text-red-500 font-medium">
                    Error: La receta original no tiene un rendimiento configurado. Edite la receta primero.
                 </p>
            )}
          </div>
        </div>
      </div>

      {selectedRecipe && target > 0 && factor > 0 && (
          <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-brand-brown/10">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-brand-brown font-serif">Materia Prima Necesaria para {formatQuantity(target, yieldUnit)}</h4>
              <button
                onClick={generateProductionPDF}
                className="text-brand-brown hover:text-brand-accent transition-colors bg-brand-brown/5 hover:bg-brand-brown/10 p-2 rounded-lg"
                title="Descargar PDF de Producción"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
            </div>
            <ul className="space-y-2 mt-4">
              {selectedRecipe.ingredients.map((ing, idx) => {
                const details = getIngredientDetails(ing);
                const needed = ing.quantityUsed * factor;
                return (
                  <li key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 bg-brand-beige/30 p-3 rounded-lg border border-brand-brown/5">
                    <span className="font-medium text-brand-brown">{details.name}</span>
                    <span className="font-bold text-brand-brown bg-white px-3 py-1 rounded-md shadow-sm border border-brand-brown/10 self-end sm:self-auto">{formatQuantity(needed, details.baseUnit)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
      )}
    </div>
  );
};

export default ProductionCalculator;

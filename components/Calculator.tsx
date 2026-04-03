import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { Recipe, Ingredient } from '../types';
import jsPDF from 'jspdf';

interface Props {
  userId: string;
}

const Calculator: React.FC<Props> = ({ userId }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [sellWeight, setSellWeight] = useState('');
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

  // Calculations
  const weight = parseFloat(sellWeight) || 0;
  const costPerGram = selectedRecipe ? selectedRecipe.costPerGram : 0;

  const realCost = costPerGram * weight;
  const suggestedPrice = realCost * 3;
  const profit = suggestedPrice - realCost;

  const [customPrice, setCustomPrice] = useState('');

  useEffect(() => {
    if (suggestedPrice) {
      setCustomPrice(Math.round(suggestedPrice).toString());
    }
  }, [suggestedPrice]);

  const generateTicket = async (isReseller: boolean = false) => {
    if (!selectedRecipe) return;

    const finalPrice = parseFloat(customPrice) || 0;

    try {
      console.log("Iniciando generación de PDF...");
      // alert("Iniciando generación de PDF..."); 

      const finalHeight = isReseller ? 180 : 220;

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [80, finalHeight]
      });

      const drawContent = (withLogo: boolean) => {
        try {
          // Header
          // Moved everything up: less margin after logo
          let currentY = withLogo ? 47 : 12;

          // Helper for centering text
          const centerText = (text: string, y: number, fontSize: number, fontType: string = "normal") => {
            doc.setFontSize(fontSize);
            doc.setFont("helvetica", fontType);
            doc.text(text, 40, y, { align: "center", maxWidth: 74 });
          };

          // Shop Name (Optional, maybe skip to save space or keep small)
          // centerText("Alternativa Keto", currentY, 12, "bold");
          // currentY += 5;

          // Product Name (Uppercase and Bold)
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          const splitTitle = doc.splitTextToSize(selectedRecipe.name.toUpperCase(), 70);
          doc.text(splitTitle, 40, currentY, { align: "center" });
          currentY += (splitTitle.length * 6) + 1;

          // Divider Line (Bold)
          doc.setLineWidth(1);
          doc.line(1, currentY, 79, currentY);
          currentY += 3;

          if (!isReseller) {
            // PRICE (Re-added)
            doc.setFontSize(24);
            doc.setFont("helvetica", "bold");
            doc.text(`$${Math.round(finalPrice).toLocaleString('es-AR')}`, 40, currentY + 5, { align: "center" });
            currentY += 10;

            // Divider Line (Bold)
            doc.setLineWidth(1);
            doc.line(1, currentY, 79, currentY);
            currentY += 4;
          }

          // DATOS NUTRICIONALES Header
          centerText("DATOS NUTRICIONALES", currentY, 11, "bold");
          currentY += 2;

          doc.setLineWidth(0.5);
          doc.line(1, currentY + 2, 79, currentY + 2);
          currentY += 6;

          // Portion Info
          const portionWeight = selectedRecipe.portionWeight || 0;
          const portionText = selectedRecipe.isPromo 
            ? `PROMOCIÓN` 
            : (portionWeight > 0
              ? `PORCIÓN: ${portionWeight}G`
              : `PORCIÓN: ${weight}G`);

          centerText(portionText, currentY, 10, "bold");
          currentY += 2;

          doc.setLineWidth(0.5);
          doc.line(1, currentY + 2, 79, currentY + 2);
          currentY += 6;

          // Nutrients Table Headers
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text("NUTRIENTE", 1, currentY);
          doc.text("CANT.", 79, currentY, { align: "right" });
          currentY += 2;

          doc.setLineWidth(0.5);
          doc.line(1, currentY, 79, currentY);
          currentY += 5;

          // Nutrients Data Calculation
          let factor = 0;
          if (selectedRecipe.isPromo) {
            factor = 1; // Para promos, los nutrientes ya son el valor total calculado
          } else if (portionWeight > 0 && selectedRecipe.totalYieldWeight > 0) {
            factor = portionWeight > selectedRecipe.totalYieldWeight 
              ? 1 / selectedRecipe.totalYieldWeight 
              : portionWeight / selectedRecipe.totalYieldWeight;
          } else if (weight > 0 && selectedRecipe.totalYieldWeight > 0) {
            factor = weight / selectedRecipe.totalYieldWeight;
          }

          const calcValue = (val: number | undefined) => {
            if (!val) return "0";
            if (selectedRecipe.isPromo) return Math.round(val).toString();
            if (factor > 0) {
              return Math.round(val * factor).toString();
            }
            return Math.round(val).toString();
          };

          const nutrients = [
            { label: "ENERGÍA", value: `${calcValue(selectedRecipe.nutritionalInfo?.calories)} KCAL` },
            { label: "GRASAS", value: `${calcValue(selectedRecipe.nutritionalInfo?.fat)}G` },
            { label: "CARBOS", value: `${calcValue(selectedRecipe.nutritionalInfo?.carbs)}G` },
            { label: "PROTEÍNA", value: `${calcValue(selectedRecipe.nutritionalInfo?.protein)}G` },
            { label: "FIBRA", value: `${calcValue(selectedRecipe.nutritionalInfo?.fiber)}G` },
          ];

          nutrients.forEach(nut => {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(nut.label, 1, currentY);
            doc.text(nut.value, 79, currentY, { align: "right" });
            currentY += 5;
          });

          // Divider after nutrients
          doc.setLineWidth(1);
          doc.line(1, currentY, 79, currentY);
          currentY += 5;

          // CONSERVACIÓN Section
          if (selectedRecipe.conservation) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("CONSERVACIÓN:", 1, currentY);
            currentY += 4;

            doc.setFontSize(10);
            doc.setFont("helvetica", "italic"); // Italic for conservation text details
            const conservationLines = doc.splitTextToSize(selectedRecipe.conservation.toUpperCase(), 78);
            doc.text(conservationLines, 1, currentY);
            currentY += (conservationLines.length * 4) + 2;
          }

          // BOX: MANTENGA EN LUGAR FRESCO
          doc.setLineWidth(0.5);
          doc.rect(1, currentY, 78, 8);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text("MANTENGA EN LUGAR FRESCO", 40, currentY + 5.5, { align: "center" });
          currentY += 12;

          // Divider
          doc.setLineWidth(1);
          doc.line(1, currentY, 79, currentY);
          currentY += 5;

          // Dates
          const today = new Date();
          const elabDate = today.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

          // Logic for expiration date: default 7 days if not parsed from conservation text
          // Simple default: +7 days
          const expirationDate = new Date();
          expirationDate.setDate(today.getDate() + 7);
          const venceDate = expirationDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(`ELAB: ${elabDate}`, 1, currentY);
          currentY += 4;
          doc.text(`VENCE: ${venceDate}`, 1, currentY);
          currentY += 5;

          if (!isReseller) {
            // NET WEIGHT BOX
            if (selectedRecipe.isPromo) {
              doc.setLineWidth(1);
              doc.rect(1, currentY, 78, 8);
              doc.setFontSize(11);
              doc.setFont("helvetica", "bold");
              doc.text(`CANTIDAD: ${weight} UN`, 40, currentY + 5.5, { align: "center" });
              currentY += 10;
            } else {
              doc.setLineWidth(1);
              doc.rect(1, currentY, 78, 8);
              doc.setFontSize(12);
              doc.setFont("helvetica", "bold");
              doc.text(`NETO: ${weight}G`, 40, currentY + 5.5, { align: "center" });
              currentY += 10;
            }
          }

          // SIN AZUCAR BOX
          doc.setLineWidth(1);
          doc.rect(20, currentY, 40, 8);
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text("SIN AZÚCAR", 40, currentY + 5.5, { align: "center" });
          currentY += 11;

          if (selectedRecipe.isPromo && selectedRecipe.promoItems && selectedRecipe.promoItems.length > 0) {
            const promoItemsText = "INCLUYE: " + selectedRecipe.promoItems.map(pi => {
              const r = recipes.find(rec => rec.id === pi.recipeId);
              return r ? `${pi.quantityUsed}x ${r.name}` : '';
            }).filter(n => n).join(', ').toUpperCase();
             
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            const promoLines = doc.splitTextToSize(promoItemsText, 78);
            doc.text(promoLines, 1, currentY);
            currentY += (promoLines.length * 3) + 3;
          }

          // Footer / Social
          currentY += 10;
          // Instagram Icon & Handle
          const startX = 18; // Centering roughly
          // const iconY = currentY;

          // Re-using social icon code but adjusting position
          // ... (Simpler social text for this layout)

          doc.setFontSize(10);
          doc.setFont("helvetica", "bolditalic");
          doc.text("¡MUCHAS GRACIAS!", 40, currentY, { align: "center" });

          // Instagram text below
          currentY += 5;
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.text("@alternativaketo", 40, currentY, { align: "center" });

          currentY += 5;
          doc.setFontSize(11); // Increased from 9
          doc.setFont("helvetica", "bold"); // Made bold
          doc.text("www.alternativaketo.com", 40, currentY + 2, { align: "center" });

          if (isReseller && ingredients.length > 0) {
            const recipeIngredients = selectedRecipe.ingredients.map(ri => {
              const ing = ingredients.find(i => i.id === ri.ingredientId);
              return ing ? ing.name : '';
            }).filter(name => name !== '');

            if (recipeIngredients.length > 0) {
              const ingText = "INGREDIENTES MÁS UTILIZADOS: " + recipeIngredients.join(', ').toUpperCase();
              currentY += 8;
              doc.setFontSize(9);
              doc.setFont("helvetica", "bold");
              const ingLines = doc.splitTextToSize(ingText, 78);
              doc.text(ingLines, 1, currentY);
              currentY += (ingLines.length * 4);
            }
          }

          // Ensure simple filename and open in new tab
          const cleanName = selectedRecipe.name.replace(/[^a-zA-Z0-9]/g, '_');

          // Descargar directamente
          doc.save(`ticket_${cleanName}.pdf`);

        } catch (innerErr: any) {
          console.error("Error drawing content:", innerErr);
          alert(`Error al dibujar contenido del PDF: ${innerErr.message}`);
        }
      };

      if (isReseller) {
        drawContent(false);
        return;
      }

      const img = new Image();
      // Use proper base URL for GitHub Pages / Dev
      // Remove trailing slash if present to avoid double slash, though usually fine
      const logoPath = `${import.meta.env.BASE_URL}logo.png`;
      console.log("Loading logo from:", logoPath);
      img.src = logoPath;

      img.onload = () => {
        try {
          // Logo resized and moved up
          doc.addImage(img, 'PNG', 20, 5, 40, 40, undefined, 'FAST');
          drawContent(true);
        } catch (imgErr: any) {
          console.error("Error adding image:", imgErr);
          // If image adds fail, try content without logo
          drawContent(false);
        }
      };

      img.onerror = (e) => {
        console.warn("Logo load failed", e);
        // Fallback to no-logo layout
        drawContent(false);
      };

    } catch (err: any) {
      console.error("PDF Generation Error:", err);
      alert(`Error al iniciar generación de PDF: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-brand-brown/10">
        <h2 className="text-xl font-bold text-brand-brown mb-4 sm:mb-6 font-serif">Calculadora de Venta</h2>

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
              onChange={(e) => setSelectedRecipeId(e.target.value)}
              className="w-full p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 bg-brand-beige/50 text-brand-brown cursor-pointer"
            >
              <option value="">-- Elige una preparación --</option>
              {recipes.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="opacity-100 transition-opacity duration-300">
            <label className="block text-sm font-bold text-brand-brown mb-1">
              Cantidad a Vender (Peso/Unidad)
            </label>
            <input
              type="number"
              value={sellWeight}
              onChange={(e) => setSellWeight(e.target.value)}
              disabled={!selectedRecipeId}
              className="w-full p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-lg font-semibold bg-brand-beige/50 disabled:bg-gray-100 text-brand-brown placeholder-brand-brown/40"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {selectedRecipeId && weight > 0 && (
        <div className="space-y-4">
          {/* Main Result Card */}
          <div className="bg-brand-brown text-white p-5 sm:p-6 rounded-3xl shadow-lg transform transition-all duration-300 hover:scale-[1.02]">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0">
              <div className="w-full sm:w-auto">
                <p className="text-brand-accent text-sm font-bold mb-1 uppercase tracking-wider">Precio Sugerido (x3)</p>
                <h3 className="text-4xl sm:text-5xl font-bold tracking-tight font-serif break-all">${suggestedPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
              </div>
              <div className="text-left sm:text-right opacity-90 w-full sm:w-auto bg-white/10 sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none">
                <p className="text-xs uppercase tracking-wider text-brand-accent/80 sm:text-white/80">Margen Bruto</p>
                <p className="font-bold text-xl sm:text-base text-brand-accent sm:text-white">${profit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
            </div>

            <div className="mt-5 sm:mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
              <span className="text-sm opacity-80">Costo Real de Producción:</span>
              <span className="text-2xl sm:text-xl font-bold">${realCost.toFixed(2)}</span>
            </div>
          </div>

          {/* Custom Price Input */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-brand-brown/10">
            <label className="block text-sm font-bold text-brand-brown mb-2">Precio de Venta Final (para Ticket)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-brown font-bold">$</span>
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-full pl-8 p-3 rounded-xl border border-brand-brown/20 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 text-xl font-bold text-brand-brown"
                placeholder="Ingrese precio..."
              />
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-brand-brown/10">
            <h4 className="font-bold text-brand-brown mb-3 font-serif">{selectedRecipe?.isPromo ? 'Detalles de la Promoción' : 'Detalles de la Receta'}</h4>
            <div className="text-sm text-brand-brown/80 flex flex-col gap-2 sm:grid sm:grid-cols-2">
              {!selectedRecipe?.isPromo && <div className="bg-brand-beige/30 p-2 sm:p-0 sm:bg-transparent rounded flex justify-between sm:block"><span>Yield Total:</span> <span className="font-medium sm:ml-1">{selectedRecipe?.totalYieldWeight}</span></div>}
              <div className={`bg-brand-beige/30 p-2 sm:p-0 sm:bg-transparent rounded flex justify-between sm:block ${selectedRecipe?.isPromo ? 'col-span-2' : ''}`}><span>Costo Total:</span> <span className="font-medium sm:ml-1">${selectedRecipe?.totalCost.toFixed(2)}</span></div>
              {!selectedRecipe?.isPromo && <div className="bg-brand-beige/30 p-2 sm:p-0 sm:bg-transparent rounded col-span-2 flex justify-between sm:block"><span>Costo Base:</span> <span className="font-medium sm:ml-1">${selectedRecipe?.costPerGram.toFixed(4)} / gr</span></div>}
            </div>
          </div>

          {/* PDF Ticket Button */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => generateTicket(false)}
              className="w-full bg-[#2C1810] text-white py-3 sm:py-4 rounded-xl font-bold shadow-md hover:bg-black transition flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Generar Ticket PDF
            </button>

            {/* Reseller PDF Ticket Button */}
            <button
              onClick={() => generateTicket(true)}
              className="w-full bg-white text-brand-brown border-2 border-[#2C1810] py-3 sm:py-4 rounded-xl font-bold shadow-sm hover:bg-brand-brown/5 transition flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Generar Ticket Revendedor
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calculator;
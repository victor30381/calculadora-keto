import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { Recipe } from '../types';
import jsPDF from 'jspdf';

interface Props {
  userId: string;
}

const Calculator: React.FC<Props> = ({ userId }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
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

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);

  // Calculations
  const weight = parseFloat(sellWeight) || 0;
  const costPerGram = selectedRecipe ? selectedRecipe.costPerGram : 0;

  const realCost = costPerGram * weight;
  const suggestedPrice = realCost * 3;
  const profit = suggestedPrice - realCost;

  const generateTicket = () => {
    if (!selectedRecipe) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 150]
    });

    const drawContent = (withLogo: boolean) => {
      // Header
      const headerY = withLogo ? 55 : 20;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Alternativa Keto", 40, headerY, { align: "center" });

      // Divider
      doc.setFontSize(8);
      doc.text("----------------------------------------", 40, headerY + 5, { align: "center" });

      // Product Details
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(selectedRecipe.name, 40, headerY + 15, { align: "center", maxWidth: 70 });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`${weight} g`, 40, headerY + 25, { align: "center" });

      // Price
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text(`$${suggestedPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 40, headerY + 40, { align: "center" });

      // Footer
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text("¡Gracias por su compra!", 40, headerY + 55, { align: "center" });

      // Instagram Icon & Handle
      const startX = 25;
      const iconY = headerY + 58;

      // Icon Background (Rounded Rect)
      doc.setDrawColor(0);
      doc.setLineWidth(0.3);
      doc.roundedRect(startX, iconY, 5, 5, 1.5, 1.5, 'S');

      // Inner Circle
      doc.circle(startX + 2.5, iconY + 2.5, 1.2, 'S');

      // Dot
      doc.circle(startX + 4, iconY + 1, 0.3, 'F');

      // Text
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("@alternativaketo", startX + 7, iconY + 3.5, { align: "left" });

      doc.save(`${selectedRecipe.name.replace(/\s+/g, '_')}_ticket.pdf`);
    };

    const img = new Image();
    // Use proper base URL for GitHub Pages
    img.src = `${import.meta.env.BASE_URL}logo.png`;

    img.onload = () => {
      doc.addImage(img, 'PNG', 20, 10, 40, 40);
      drawContent(true);
    };

    img.onerror = () => {
      drawContent(false);
    };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100">
        <h2 className="text-xl font-bold text-rose-500 mb-6">Calculadora de Venta</h2>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {errorMsg}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Seleccionar Receta</label>
            <select
              value={selectedRecipeId}
              onChange={(e) => setSelectedRecipeId(e.target.value)}
              className="w-full p-3 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 bg-gray-50 text-black"
            >
              <option value="">-- Elige una preparación --</option>
              {recipes.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="opacity-100 transition-opacity duration-300">
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Cantidad a Vender (Peso/Unidad)
            </label>
            <input
              type="number"
              value={sellWeight}
              onChange={(e) => setSellWeight(e.target.value)}
              disabled={!selectedRecipeId}
              className="w-full p-3 rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400 text-lg font-semibold bg-gray-50 disabled:bg-slate-100 text-black placeholder-gray-400"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {selectedRecipeId && weight > 0 && (
        <div className="space-y-4">
          {/* Main Result Card */}
          <div className="bg-gradient-to-br from-rose-400 to-rose-600 p-6 rounded-3xl shadow-lg text-white transform transition-all duration-300 hover:scale-[1.02]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-rose-100 text-sm font-medium mb-1">Precio Sugerido (x3)</p>
                <h3 className="text-4xl font-bold tracking-tight">${suggestedPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</h3>
              </div>
              <div className="text-right opacity-80">
                <p className="text-xs">Margen Bruto</p>
                <p className="font-bold">${profit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/20 flex justify-between items-center">
              <span className="text-sm">Costo Real de Producción:</span>
              <span className="text-xl font-bold">${realCost.toFixed(2)}</span>
            </div>
          </div>

          {/* Info Card */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <h4 className="font-semibold text-slate-700 mb-2">Detalles de la Receta</h4>
            <div className="text-sm text-slate-600 grid grid-cols-2 gap-2">
              <div>Yield Total: <span className="font-medium">{selectedRecipe?.totalYieldWeight}</span></div>
              <div>Costo Total: <span className="font-medium">${selectedRecipe?.totalCost.toFixed(2)}</span></div>
              <div className="col-span-2">Costo Base: <span className="font-medium">${selectedRecipe?.costPerGram.toFixed(4)} / gr</span></div>
            </div>
          </div>

          {/* PDF Ticket Button */}
          <button
            onClick={generateTicket}
            className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold shadow-md hover:bg-slate-900 transition flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Generar Ticket PDF
          </button>
        </div>
      )}
    </div>
  );
};

export default Calculator;
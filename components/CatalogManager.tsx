import React, { useState, useEffect } from 'react';
import { db, storage, functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { collection, query, where, onSnapshot, updateDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { Recipe } from '../types';
import { User } from 'firebase/auth';

interface CatalogManagerProps {
    userId: string;
    user: User | null;
}

const CatalogManager: React.FC<CatalogManagerProps> = ({ userId, user }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [editingRecipe, setEditingRecipe] = useState<string | null>(null);
    const [tempPrice, setTempPrice] = useState('');
    const [tempDescription, setTempDescription] = useState('');
    const [tempSection, setTempSection] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [sections, setSections] = useState<string[]>([]);
    const [newSectionName, setNewSectionName] = useState('');
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

    useEffect(() => {
        if (!userId) return;
        const fetchSections = async () => {
            try {
                const profileRef = doc(db, 'userProfiles', userId);
                const snap = await getDoc(profileRef);
                if (snap.exists() && snap.data().catalogSections) {
                    setSections(snap.data().catalogSections);
                }
            } catch (err) {
                console.error("Error fetching sections:", err);
            }
        };
        fetchSections();

        const q = query(collection(db, 'recipes'), where('userId', '==', userId));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
            data.sort((a, b) => a.name.localeCompare(b.name));
            setRecipes(data);
        });
        return () => unsub();
    }, [userId]);

    const handleToggleCatalog = async (recipe: Recipe) => {
        try {
            await updateDoc(doc(db, 'recipes', recipe.id), {
                showInCatalog: !recipe.showInCatalog
            });
        } catch (err) {
            console.error(err);
            alert('Error al actualizar visibilidad');
        }
    };

    const handleAddSection = async () => {
        if (!newSectionName.trim()) return;
        const name = newSectionName.trim();
        if (sections.includes(name)) {
            alert('Esta sección ya existe');
            return;
        }
        const updated = [...sections, name];
        setSections(updated);
        setNewSectionName('');
        try {
            await setDoc(doc(db, 'userProfiles', userId), { catalogSections: updated }, { merge: true });
        } catch (err) {
            console.error(err);
            alert('Error al guardar la sección en el perfil');
        }
    };

    const handleRemoveSection = async (sectionToRemove: string) => {
        if (!confirm(`¿Seguro que quieres eliminar la sección "${sectionToRemove}"?`)) return;
        const updated = sections.filter(s => s !== sectionToRemove);
        setSections(updated);
        try {
            await setDoc(doc(db, 'userProfiles', userId), { catalogSections: updated }, { merge: true });
            
            // Actualizar recetas que tengan esa sección asignada
            const recipesToUpdate = recipes.filter(r => r.catalogSection === sectionToRemove);
            for (const r of recipesToUpdate) {
                await updateDoc(doc(db, 'recipes', r.id), { catalogSection: '' });
            }
        } catch (err) {
            console.error(err);
            alert('Error al eliminar la sección');
        }
    };

    const handleSaveDetails = async (recipeId: string) => {
        try {
            await updateDoc(doc(db, 'recipes', recipeId), {
                catalogPrice: parseFloat(tempPrice) || 0,
                catalogDescription: tempDescription.trim(),
                catalogSection: tempSection,
                showInCatalog: true // Auto-publish if they are actively editing details
            });
            setEditingRecipe(null);
        } catch (err) {
            console.error(err);
            alert('Error al guardar detalles');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, recipe: Recipe) => {
        if (!e.target.files || e.target.files.length === 0) return;
        if (!userId) return;
        
        const file = e.target.files[0];
        setIsUploading(true);
        try {
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `catalog/${userId}/${recipe.id}_${Date.now()}.${fileExt}`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            
            const currentImages = recipe.catalogImages || [];
            await updateDoc(doc(db, 'recipes', recipe.id), {
                catalogImages: [...currentImages, downloadURL]
            });
        } catch (err) {
            console.error(err);
            alert('Error al subir la imagen. Verifica las reglas de Storage de Firebase.');
        } finally {
            setIsUploading(false);
            e.target.value = ''; // clear input
        }
    };

    const handleRemoveImage = async (recipe: Recipe, imageUrl: string) => {
        if (!confirm('¿Seguro quieres eliminar esta imagen?')) return;
        const currentImages = recipe.catalogImages || [];
        const newImages = currentImages.filter(url => url !== imageUrl);
        
        try {
            await updateDoc(doc(db, 'recipes', recipe.id), {
                catalogImages: newImages
            });
            // Try to delete from storage as well
            const decodedUrl = decodeURIComponent(imageUrl);
            const pathStartIndex = decodedUrl.indexOf('/o/') + 3;
            const pathEndIndex = decodedUrl.indexOf('?alt=media');
            if (pathStartIndex > 2 && pathEndIndex > -1) {
                const filePath = decodedUrl.substring(pathStartIndex, pathEndIndex);
                const fileRef = ref(storage, filePath);
                await deleteObject(fileRef).catch(e => console.log('File already deleted or not found: ', e));
            }
        } catch (err) {
            console.error(err);
            alert('Error al eliminar imagen');
        }
    };

    const handleGenerateDescription = async (recipe: Recipe) => {
        try {
            setIsGeneratingDescription(true);
            const generateDescription = httpsCallable(functions, 'generateDescription');
            
            let ingredientsText = "";
            if (recipe.ingredients && recipe.ingredients.length > 0) {
               ingredientsText = `Posee ${recipe.ingredients.length} ingredientes. `;
            }
            if (recipe.nutritionalInfo) {
               ingredientsText += `Macros por porción: ${recipe.nutritionalInfo.calories} Kcal, ${recipe.nutritionalInfo.protein}g Proteína, ${recipe.nutritionalInfo.carbs}g Carbohidratos (Bajos), ${recipe.nutritionalInfo.fat}g Grasas.`;
            }

            const result = await generateDescription({
                recipeName: recipe.name,
                ingredientsText,
                imageUrls: recipe.catalogImages || []
            });
            
            const data = result.data as { description: string };
            if (data?.description) {
                setTempDescription(data.description);
            }
        } catch (error: any) {
            console.error("AI Error:", error);
            alert("Hubo un error al generar la descripción: " + error.message);
        } finally {
            setIsGeneratingDescription(false);
        }
    };

    return (
        <div className="space-y-6 pb-20 animate-fade-in">
            {/* Header / Link Copy */}
            <div className="bg-brand-brown/5 rounded-2xl p-5 md:p-8 border border-brand-brown/10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-brand-brown mb-2 flex items-center gap-2">
                            <span>🛍️</span> Gestión de Mi Catálogo Público
                        </h2>
                        <p className="text-sm text-brand-brown/60">
                            Activa los productos que quieres que vean tus clientes y configura sus precios de venta finales.
                        </p>
                    </div>
                    {user && (
                        <div className="flex flex-col w-full md:w-auto gap-2">
                            <label className="text-[10px] font-bold text-brand-brown uppercase tracking-wider ml-1">Tu Enlace Para Clientes</label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value="https://www.alternativaketo.com"
                                    className="p-3 rounded-xl border border-brand-brown/20 bg-white text-brand-brown text-sm font-medium outline-none text-center sm:text-left shadow-sm min-w-[250px]"
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText("https://www.alternativaketo.com");
                                        alert('¡Enlace copiado al portapapeles!');
                                    }}
                                    className="px-6 py-3 bg-brand-brown text-white font-bold rounded-xl hover:bg-[#5D4229] transition-colors whitespace-nowrap shadow-md text-sm"
                                >
                                    Copiar Link
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sections Manager */}
            <div className="bg-brand-brown/5 rounded-2xl p-5 border border-brand-brown/10 shadow-sm">
                <h3 className="font-bold text-brand-brown text-sm mb-3 uppercase tracking-wide">Secciones (Categorías)</h3>
                <div className="flex flex-wrap gap-2 items-center mb-3">
                    {sections.map(sec => (
                        <span key={sec} className="group bg-white pl-3 pr-1 py-1 rounded-lg text-sm font-bold text-brand-brown border border-brand-brown/20 shadow-sm flex items-center gap-1.5 transition-all">
                            {sec}
                            <button 
                                onClick={() => handleRemoveSection(sec)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-full transition-colors"
                                title="Eliminar sección"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </span>
                    ))}
                    {sections.length === 0 && <span className="text-sm text-brand-brown/50 italic">Sin secciones creadas</span>}
                </div>
                <div className="flex gap-2 max-w-sm">
                    <input 
                        type="text" 
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        placeholder="Ej. Promos, Budines..."
                        className="flex-1 p-2.5 rounded-xl border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none text-brand-brown text-sm font-medium bg-white shadow-sm"
                        onKeyPress={e => e.key === 'Enter' && handleAddSection()}
                    />
                    <button 
                        onClick={handleAddSection}
                        className="px-4 py-2.5 warm-gradient-brown text-white font-bold rounded-xl hover:opacity-90 transition-opacity text-sm shadow-md flex items-center justify-center gap-1"
                    >
                        <span className="text-lg leading-none">+</span> Crear
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {recipes.map(recipe => (
                    <div key={recipe.id} className={`glass-card rounded-2xl p-5 border-2 transition-all ${recipe.showInCatalog ? 'border-green-400/50 shadow-md ring-1 ring-green-100' : 'border-transparent opacity-80'}`}>
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="font-serif font-bold text-lg text-brand-brown leading-tight">{recipe.name}</h3>
                            {/* Toggle */}
                            <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                                <input type="checkbox" className="sr-only peer" checked={!!recipe.showInCatalog} onChange={() => handleToggleCatalog(recipe)} />
                                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                        
                        <div className="flex items-center gap-2 mb-4">
                            {!recipe.showInCatalog ? (
                                <span className="text-xs font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-md">Oculto en Catálogo</span>
                            ) : (
                                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-md">Visible en Catálogo</span>
                            )}
                        </div>

                        {/* Images Gallery */}
                        <div className="mb-4">
                            {recipe.catalogImages && recipe.catalogImages.length > 0 && (
                                <div className="flex gap-2 overflow-x-auto py-2 custom-scrollbar">
                                    {recipe.catalogImages.map((imgUrl, i) => (
                                        <div key={i} className="relative group shrink-0">
                                            <img src={imgUrl} alt="Product" className="h-24 w-24 object-cover rounded-lg border border-brand-brown/10 shadow-sm transition-transform hover:scale-105" />
                                            <button 
                                                onClick={() => handleRemoveImage(recipe, imgUrl)}
                                                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs shadow-md"
                                                title="Eliminar imagen"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="mt-2">
                                <label className={`text-xs font-bold text-brand-brown bg-brand-brown/5 px-3 py-1.5 rounded-lg border border-brand-brown/10 cursor-pointer hover:bg-brand-brown/10 transition-colors inline-block ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {isUploading ? 'Subiendo...' : '+ Agregar Foto'}
                                    <input type="file" className="hidden" accept="image/*" disabled={isUploading} onChange={(e) => handleImageUpload(e, recipe)} />
                                </label>
                            </div>
                        </div>

                        {/* Editor OR View */}
                        {editingRecipe === recipe.id ? (
                            <div className="space-y-3 bg-brand-brown/5 p-3 rounded-xl border border-brand-brown/10 animate-fade-in">
                                <div>
                                    <label className="block text-[11px] font-bold text-brand-brown/60 mb-1 uppercase">Precio Público ($)</label>
                                    <input 
                                        autoFocus
                                        type="number" 
                                        value={tempPrice} 
                                        onChange={(e) => setTempPrice(e.target.value)}
                                        className="w-full p-2.5 rounded-lg border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none text-brand-brown font-bold"
                                        placeholder="Ej. 15000"
                                    />
                                    <p className="text-[10px] text-brand-brown/40 mt-1 pl-1">Costo real de receta: ${recipe.totalCost.toFixed(2)}</p>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-[11px] font-bold text-brand-brown/60 uppercase">Descripción Larga (Opcional)</label>
                                        <button
                                            type="button"
                                            onClick={() => handleGenerateDescription(recipe)}
                                            disabled={isGeneratingDescription}
                                            className="flex items-center gap-1 text-[10px] font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-600 px-2 py-1 rounded shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                                            title="Generar copy con Inteligencia Artificial"
                                        >
                                            {isGeneratingDescription ? (
                                                <span className="flex items-center gap-1">
                                                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                </span>
                                            ) : '✨ Auto-Copy'}
                                        </button>
                                    </div>
                                    <textarea 
                                        value={tempDescription} 
                                        onChange={(e) => setTempDescription(e.target.value)}
                                        className="w-full p-2.5 rounded-lg border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none text-brand-brown text-sm resize-none"
                                        rows={2}
                                        placeholder="Descripción atractiva para el cliente..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-brand-brown/60 mb-1 uppercase">Sección del Catálogo</label>
                                    <select 
                                        value={tempSection} 
                                        onChange={(e) => setTempSection(e.target.value)}
                                        className="w-full p-2.5 rounded-lg border border-brand-brown/20 focus:ring-2 focus:ring-brand-accent/50 outline-none text-brand-brown text-sm bg-white"
                                    >
                                        <option value="">Sin sección</option>
                                        {sections.map(sec => (
                                            <option key={sec} value={sec}>{sec}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button onClick={() => setEditingRecipe(null)} className="flex-1 py-2 rounded-lg text-xs font-bold text-brand-brown hover:bg-brand-brown/10 transition-colors">Cancelar</button>
                                    <button onClick={() => handleSaveDetails(recipe.id)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-brand-brown text-white hover:bg-[#5D4229] transition-colors">Guardar</button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-2xl font-bold text-brand-brown">${recipe.catalogPrice?.toLocaleString() || '0'}</p>
                                {recipe.catalogDescription && (
                                    <p className="text-xs text-brand-brown/70 bg-brand-brown/5 p-2 rounded-lg line-clamp-2" title={recipe.catalogDescription}>
                                        {recipe.catalogDescription}
                                    </p>
                                )}
                                {recipe.catalogSection && (
                                    <div className="mt-2 inline-block bg-brand-brown/10 px-2.5 py-1 rounded-md text-[10px] font-bold text-brand-brown uppercase tracking-wide">
                                        Sección: {recipe.catalogSection}
                                    </div>
                                )}
                                <div className="pt-2">
                                    <button 
                                        onClick={() => {
                                            setEditingRecipe(recipe.id);
                                            setTempPrice(recipe.catalogPrice?.toString() || '');
                                            setTempDescription(recipe.catalogDescription || '');
                                            setTempSection(recipe.catalogSection || '');
                                        }}
                                        className="text-xs font-bold text-brand-accent hover:text-brand-brown transition-colors flex items-center gap-1"
                                    >
                                        ✏️ Editar Precio o Descripción
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {recipes.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                        <span className="text-6xl mb-4 block opacity-50">🍰</span>
                        <h3 className="text-xl font-bold text-brand-brown mb-2 font-serif">Aún no tienes recetas</h3>
                        <p className="text-brand-brown/50 max-w-sm mx-auto">Dirígete a la "Calculadora Maestra" para crear tus primeros productos, luego podrás publicarlos aquí.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CatalogManager;

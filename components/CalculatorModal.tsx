import React, { useState } from 'react';
import Ingredients from './Ingredients';
import Recipes from './Recipes';
import Calculator from './Calculator';
import ProductionCalculator from './ProductionCalculator';

interface CalculatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, onClose, userId }) => {
    const [activeTab, setActiveTab] = useState<'inventory' | 'recipes' | 'calc' | 'production'>('inventory');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-md"
                onClick={onClose}
            ></div>

            {/* Modal Container */}
            <div className="relative w-full max-w-4xl glass-card-strong rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">

                {/* Header */}
                <div className="flex justify-between items-center p-4 sm:p-6 pb-2 border-b border-brand-brown/5 relative">
                    <div className="flex-1 text-center px-8 sm:px-12">
                        <h2 className="text-xl sm:text-2xl font-serif font-bold text-brand-brown">Calculadora Maestra</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 sm:right-6 sm:top-6 text-brand-brown/50 hover:text-brand-brown transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modern Segmented Tabs */}
                <div className="px-4 sm:px-6 pt-4 sm:pt-6">
                    <div className="bg-brand-brown/5 p-1.5 rounded-2xl flex flex-wrap sm:flex-nowrap gap-1.5 relative z-10 w-full items-center">
                        <button
                            onClick={() => setActiveTab('inventory')}
                            className={`
                        flex-1 min-w-[45%] sm:min-w-0 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 text-center
                        ${activeTab === 'inventory'
                                    ? 'bg-white text-brand-brown shadow-md scale-100 z-10 border border-brand-brown/5'
                                    : 'text-brand-brown/60 hover:text-brand-brown hover:bg-brand-brown/10 hover:scale-105'
                                }
                    `}
                        >
                            Materia Prima
                        </button>
                        <button
                            onClick={() => setActiveTab('recipes')}
                            className={`
                        flex-1 min-w-[45%] sm:min-w-0 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 text-center
                        ${activeTab === 'recipes'
                                    ? 'bg-white text-brand-brown shadow-md scale-100 z-10 border border-brand-brown/5'
                                    : 'text-brand-brown/60 hover:text-brand-brown hover:bg-brand-brown/10 hover:scale-105'
                                }
                    `}
                        >
                            Recetas
                        </button>
                        <button
                            onClick={() => setActiveTab('calc')}
                            className={`
                        flex-1 min-w-[45%] sm:min-w-0 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 text-center
                        ${activeTab === 'calc'
                                    ? 'bg-white text-brand-brown shadow-md scale-100 z-10 border border-brand-brown/5'
                                    : 'text-brand-brown/60 hover:text-brand-brown hover:bg-brand-brown/10 hover:scale-105'
                                }
                    `}
                        >
                            <span className="hidden sm:inline">Precio Venta (x3)</span>
                            <span className="inline sm:hidden">Venta (x3)</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('production')}
                            className={`
                        flex-1 min-w-[45%] sm:min-w-0 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 text-center
                        ${activeTab === 'production'
                                    ? 'bg-white text-brand-brown shadow-md scale-100 z-10 border border-brand-brown/5'
                                    : 'text-brand-brown/60 hover:text-brand-brown hover:bg-brand-brown/10 hover:scale-105'
                                }
                    `}
                        >
                            Proporciones
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div id="calc-modal-content" className="flex-1 overflow-y-auto p-0 bg-white/90 backdrop-blur rounded-b-2xl sm:rounded-2xl relative z-20 mt-2 border-t border-brand-brown/5">
                    <div className="p-4 sm:p-6">
                        {activeTab === 'inventory' && <Ingredients userId={userId} />}
                        {activeTab === 'recipes' && <Recipes userId={userId} />}
                        {activeTab === 'calc' && <Calculator userId={userId} />}
                        {activeTab === 'production' && <ProductionCalculator userId={userId} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalculatorModal;

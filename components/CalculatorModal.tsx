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
                <div className="flex justify-between items-center p-6 pb-2 border-b border-brand-brown/5">
                    <div className="flex-1 text-center">
                        <h2 className="text-2xl font-serif font-bold text-brand-brown">Calculadora Maestra</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute right-6 top-6 text-brand-brown/50 hover:text-brand-brown transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Custom Folder Tabs */}
                <div className="flex px-6 pt-6 gap-1 overflow-visible relative z-10">
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`
                    px-6 py-3 rounded-t-xl font-bold text-sm transition-all duration-200 relative z-20
                    ${activeTab === 'inventory'
                                ? 'warm-gradient-brown text-white shadow-lg pb-4 -mb-1'
                                : 'bg-brand-brown/5 text-brand-brown/50 hover:bg-brand-brown/10 hover:text-brand-brown pb-3'
                            }
                `}
                    >
                        Materia Prima
                    </button>
                    <button
                        onClick={() => setActiveTab('recipes')}
                        className={`
                    px-6 py-3 rounded-t-xl font-bold text-sm transition-all duration-200 relative z-10 -ml-2
                    ${activeTab === 'recipes'
                                ? 'warm-gradient-brown text-white shadow-lg pb-4 -mb-1 z-30'
                                : 'bg-brand-brown/5 text-brand-brown/50 hover:bg-brand-brown/10 hover:text-brand-brown pb-3'
                            }
                `}
                    >
                        Recetas
                    </button>
                    <button
                        onClick={() => setActiveTab('calc')}
                        className={`
                    px-6 py-3 rounded-t-xl font-bold text-sm transition-all duration-200 relative -ml-2
                    ${activeTab === 'calc'
                                ? 'warm-gradient-brown text-white shadow-lg pb-4 -mb-1 z-30'
                                : 'bg-brand-brown/5 text-brand-brown/50 hover:bg-brand-brown/10 hover:text-brand-brown pb-3 z-20'
                            }
                `}
                    >
                        Precio Venta (x3)
                    </button>
                    <button
                        onClick={() => setActiveTab('production')}
                        className={`
                    px-6 py-3 rounded-t-xl font-bold text-sm transition-all duration-200 relative -ml-2
                    ${activeTab === 'production'
                                ? 'warm-gradient-brown text-white shadow-lg pb-4 -mb-1 z-40'
                                : 'bg-brand-brown/5 text-brand-brown/50 hover:bg-brand-brown/10 hover:text-brand-brown pb-3 z-10'
                            }
                `}
                    >
                        Proporciones
                    </button>
                </div>

                {/* Content Body */}
                <div id="calc-modal-content" className="flex-1 overflow-y-auto p-0 bg-white/90 backdrop-blur border-t-4 border-brand-brown rounded-b-2xl relative z-20">
                    <div className="p-6">
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

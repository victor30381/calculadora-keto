export enum Unit {
  KG = 'Kg',
  GR = 'Gr',
  LT = 'Lt',
  UN = 'Un'
}

export interface Ingredient {
  id: string;
  userId: string;
  name: string;
  unit: Unit;
  quantity?: number;
  pricePerUnit: number;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantityUsed: number; // In grams if KG/LT, or units if UN
  calculatedCost: number;
}

export interface Recipe {
  id: string;
  userId: string;
  name: string;
  ingredients: RecipeIngredient[];
  totalYieldWeight: number; // Total weight of the result (e.g. 1500g cake)
  totalCost: number;
  costPerGram: number; // Or cost per unit if yield is 1
}

// Helper to convert units for display/calculation
// We assume:
// If Unit is KG, input is in Grams. (Factor 1000)
// If Unit is LT, input is in ML. (Factor 1000)
// If Unit is GR, input is in Grams. (Factor 1)
// If Unit is UN, input is in Units. (Factor 1)
export const getConversionFactor = (unit: Unit): number => {
  switch (unit) {
    case Unit.KG: return 1000;
    case Unit.LT: return 1000;
    case Unit.GR: return 1;
    case Unit.UN: return 1;
    default: return 1;
  }
};
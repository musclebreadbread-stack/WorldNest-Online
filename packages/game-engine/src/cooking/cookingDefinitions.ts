import type { ItemId } from "@worldnest/shared";

/**
 * A recipe the player can cook. Ingredients are consumed and the result is
 * produced after `cookTimeMs` elapses. All user-visible strings are i18n keys.
 */
export interface RecipeDefinition {
  id: string;
  resultItemId: ItemId;
  resultQuantity: number;
  ingredients: readonly RecipeIngredient[];
  cookTimeMs: number;
  titleKey: string;
}

export interface RecipeIngredient {
  itemId: ItemId;
  quantity: number;
}

/**
 * Energy restored by consuming each cooked food item. Values are deliberately
 * modest so cooking is helpful, not mandatory, and the 10-18 audience sees a
 * clear reward for the effort without trivialising the energy system.
 */
export const FOOD_ENERGY: Partial<Record<ItemId, number>> = {
  bread: 15,
  fish_pie: 30,
  carrot_soup: 25,
  fruit_salad: 20,
};

/**
 * The four starter recipes. Each uses existing raw items that the player can
 * grow, gather, or catch, turning them into food that restores energy.
 */
export const RECIPE_DEFINITIONS: Record<string, RecipeDefinition> = {
  bread: {
    id: "bread",
    resultItemId: "bread",
    resultQuantity: 1,
    ingredients: [{ itemId: "wheat", quantity: 1 }],
    cookTimeMs: 2000,
    titleKey: "cooking.recipe.bread",
  },
  fish_pie: {
    id: "fish_pie",
    resultItemId: "fish_pie",
    resultQuantity: 1,
    ingredients: [
      { itemId: "fish_common", quantity: 1 },
      { itemId: "wheat", quantity: 1 },
    ],
    cookTimeMs: 3000,
    titleKey: "cooking.recipe.fish_pie",
  },
  carrot_soup: {
    id: "carrot_soup",
    resultItemId: "carrot_soup",
    resultQuantity: 1,
    ingredients: [
      { itemId: "carrot", quantity: 2 },
      { itemId: "wheat", quantity: 1 },
    ],
    cookTimeMs: 2500,
    titleKey: "cooking.recipe.carrot_soup",
  },
  fruit_salad: {
    id: "fruit_salad",
    resultItemId: "fruit_salad",
    resultQuantity: 1,
    ingredients: [{ itemId: "melon", quantity: 2 }],
    cookTimeMs: 2000,
    titleKey: "cooking.recipe.fruit_salad",
  },
};

/** All recipe ids in definition order. */
export const RECIPE_IDS = Object.keys(RECIPE_DEFINITIONS);

/** Look up a recipe by id, or `undefined` when no such recipe exists. */
export function getRecipe(recipeId: string): RecipeDefinition | undefined {
  return RECIPE_DEFINITIONS[recipeId];
}

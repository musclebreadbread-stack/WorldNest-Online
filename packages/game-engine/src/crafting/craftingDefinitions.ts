import type { ItemId } from "@worldnest/shared";

/** Where a recipe can be crafted. */
export type CraftingStation = "hand" | "workbench";

/** Tool material tier, determines harvest bonus. */
export type ToolTier = "stone" | "iron";

/** Harvest speed bonus for holding a tool. */
export interface ToolBonus {
  harvestSpeedMultiplier: number;
}

/** The bonus each tier provides. */
export const TOOL_TIER_BONUS: Record<ToolTier, ToolBonus> = {
  stone: { harvestSpeedMultiplier: 1.5 },
  iron: { harvestSpeedMultiplier: 2.0 },
};

export interface CraftingIngredient {
  itemId: ItemId;
  quantity: number;
}

/**
 * A recipe the player can craft. Ingredients are consumed and the result is
 * produced after `craftTimeMs` elapses at the required station.
 */
export interface CraftingRecipe {
  id: string;
  station: CraftingStation;
  ingredients: readonly CraftingIngredient[];
  resultItemId: ItemId;
  resultQuantity: number;
  craftTimeMs: number;
  titleKey: string;
}

export const CRAFTING_RECIPES: Record<string, CraftingRecipe> = {
  iron_ingot: {
    id: "iron_ingot",
    station: "workbench",
    ingredients: [{ itemId: "ore", quantity: 2 }],
    resultItemId: "iron_ingot",
    resultQuantity: 1,
    craftTimeMs: 3000,
    titleKey: "recipe.iron_ingot",
  },
  plank: {
    id: "plank",
    station: "hand",
    ingredients: [{ itemId: "wood", quantity: 2 }],
    resultItemId: "plank",
    resultQuantity: 1,
    craftTimeMs: 1000,
    titleKey: "recipe.plank",
  },
  cloth: {
    id: "cloth",
    station: "hand",
    ingredients: [{ itemId: "fiber", quantity: 2 }],
    resultItemId: "cloth",
    resultQuantity: 1,
    craftTimeMs: 1000,
    titleKey: "recipe.cloth",
  },
  workbench: {
    id: "workbench",
    station: "hand",
    ingredients: [
      { itemId: "plank", quantity: 4 },
      { itemId: "iron_ingot", quantity: 2 },
    ],
    resultItemId: "workbench",
    resultQuantity: 1,
    craftTimeMs: 5000,
    titleKey: "recipe.workbench",
  },
  stone_axe: {
    id: "stone_axe",
    station: "hand",
    ingredients: [
      { itemId: "stone", quantity: 3 },
      { itemId: "wood", quantity: 2 },
    ],
    resultItemId: "stone_axe",
    resultQuantity: 1,
    craftTimeMs: 3000,
    titleKey: "recipe.stone_axe",
  },
  iron_axe: {
    id: "iron_axe",
    station: "workbench",
    ingredients: [
      { itemId: "iron_ingot", quantity: 2 },
      { itemId: "plank", quantity: 1 },
    ],
    resultItemId: "iron_axe",
    resultQuantity: 1,
    craftTimeMs: 4000,
    titleKey: "recipe.iron_axe",
  },
  stone_pickaxe: {
    id: "stone_pickaxe",
    station: "hand",
    ingredients: [
      { itemId: "stone", quantity: 3 },
      { itemId: "wood", quantity: 2 },
    ],
    resultItemId: "stone_pickaxe",
    resultQuantity: 1,
    craftTimeMs: 3000,
    titleKey: "recipe.stone_pickaxe",
  },
  iron_pickaxe: {
    id: "iron_pickaxe",
    station: "workbench",
    ingredients: [
      { itemId: "iron_ingot", quantity: 2 },
      { itemId: "plank", quantity: 1 },
    ],
    resultItemId: "iron_pickaxe",
    resultQuantity: 1,
    craftTimeMs: 4000,
    titleKey: "recipe.iron_pickaxe",
  },
};

/** All crafting recipe ids in definition order. */
export const CRAFTING_RECIPE_IDS = Object.keys(CRAFTING_RECIPES);

/** Look up a crafting recipe by id. */
export function getCraftingRecipe(recipeId: string): CraftingRecipe | undefined {
  return CRAFTING_RECIPES[recipeId];
}

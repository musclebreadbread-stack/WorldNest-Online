import type { ItemId } from "@worldnest/shared";
import type { InventoryComponent } from "../components/InventoryComponent";
import { addItem, countItem, hasSpaceFor, removeItem } from "../inventory/inventoryOps";
import {
  CRAFTING_RECIPES,
  getCraftingRecipe,
  TOOL_TIER_BONUS,
  type CraftingStation,
} from "./craftingDefinitions";
import type { CraftingState } from "./craftingState";

/**
 * Whether the player has all ingredients and the correct station for a recipe.
 */
export function canCraft(
  inventory: InventoryComponent,
  recipeId: string,
  station: CraftingStation,
): boolean {
  const recipe = getCraftingRecipe(recipeId);
  if (!recipe) return false;
  if (recipe.station === "workbench" && station !== "workbench") return false;

  for (const ingredient of recipe.ingredients) {
    if (countItem(inventory, ingredient.itemId) < ingredient.quantity) {
      return false;
    }
  }
  return hasSpaceFor(inventory, recipe.resultItemId, recipe.resultQuantity);
}

/**
 * Begin crafting a recipe. Returns true if the state was updated.
 */
export function startCraft(
  state: {
    state: CraftingState;
    selectedRecipe: string | null;
    timer: number;
  },
  recipeId: string,
): boolean {
  const recipe = getCraftingRecipe(recipeId);
  if (!recipe) return false;
  if (state.state !== "idle") return false;

  state.state = "crafting";
  state.selectedRecipe = recipeId;
  state.timer = 0;
  return true;
}

/**
 * Advance the crafting timer. Returns the new state and timer.
 */
export function tickCraft(
  state: CraftingState,
  timer: number,
  deltaMs: number,
  craftTime: number,
): { state: CraftingState; timer: number } {
  if (state !== "crafting") return { state, timer };

  const newTimer = timer + deltaMs;
  if (newTimer >= craftTime) {
    return { state: "done", timer: newTimer };
  }
  return { state: "crafting", timer: newTimer };
}

/**
 * Complete a craft: remove ingredients and add the result.
 */
export function completeCraft(
  recipeId: string | null,
  inventory: InventoryComponent,
): boolean {
  if (!recipeId) return false;
  const recipe = getCraftingRecipe(recipeId);
  if (!recipe) return false;

  for (const ingredient of recipe.ingredients) {
    if (countItem(inventory, ingredient.itemId) < ingredient.quantity) {
      return false;
    }
  }
  if (!hasSpaceFor(inventory, recipe.resultItemId, recipe.resultQuantity)) {
    return false;
  }

  for (const ingredient of recipe.ingredients) {
    removeItem(inventory, ingredient.itemId, ingredient.quantity);
  }
  addItem(inventory, recipe.resultItemId, recipe.resultQuantity);
  return true;
}

/** Tool type mapping: which items qualify as which tool. */
const AXE_ITEMS: { itemId: ItemId; multiplier: number }[] = [
  { itemId: "iron_axe", multiplier: TOOL_TIER_BONUS.iron.harvestSpeedMultiplier },
  {
    itemId: "stone_axe",
    multiplier: TOOL_TIER_BONUS.stone.harvestSpeedMultiplier,
  },
];

const PICKAXE_ITEMS: { itemId: ItemId; multiplier: number }[] = [
  {
    itemId: "iron_pickaxe",
    multiplier: TOOL_TIER_BONUS.iron.harvestSpeedMultiplier,
  },
  {
    itemId: "stone_pickaxe",
    multiplier: TOOL_TIER_BONUS.stone.harvestSpeedMultiplier,
  },
];

/**
 * Returns the harvest multiplier for the best tool of the given type held
 * in inventory. Returns 1.0 (no bonus) if no matching tool is held.
 */
export function getToolBonus(
  inventory: InventoryComponent,
  toolType: "axe" | "pickaxe",
): number {
  const items = toolType === "axe" ? AXE_ITEMS : PICKAXE_ITEMS;
  for (const entry of items) {
    if (countItem(inventory, entry.itemId) > 0) return entry.multiplier;
  }
  return 1.0;
}

/**
 * Returns all recipes available at the given station.
 * 'hand' station can craft hand-only recipes.
 * 'workbench' station can craft both hand and workbench recipes.
 */
export function getAvailableRecipes(station: CraftingStation): string[] {
  return Object.values(CRAFTING_RECIPES)
    .filter((r) => r.station === station || station === "workbench")
    .map((r) => r.id);
}

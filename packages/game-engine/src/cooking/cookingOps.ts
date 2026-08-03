import type { ItemId } from "@worldnest/shared";
import type { InventoryComponent } from "../components/InventoryComponent";
import type { StatsComponent } from "../components/StatsComponent";
import { addItem, countItem, hasSpaceFor, removeItem } from "../inventory/inventoryOps";
import { FOOD_ENERGY, getRecipe } from "./cookingDefinitions";
import type { CookingState } from "./cookingState";

/**
 * Whether the player has all the ingredients for a recipe in their inventory.
 */
export function canCook(inventory: InventoryComponent, recipeId: string): boolean {
  const recipe = getRecipe(recipeId);
  if (!recipe) return false;

  for (const ingredient of recipe.ingredients) {
    if (countItem(inventory, ingredient.itemId) < ingredient.quantity) return false;
  }
  return hasSpaceFor(inventory, recipe.resultItemId, recipe.resultQuantity);
}

/**
 * Begin cooking a recipe. Returns true if the state was updated (recipe exists
 * and we were in an idle state), false otherwise.
 */
export function startCooking(
  state: { state: CookingState; selectedRecipe: string | null; timer: number },
  recipeId: string,
): boolean {
  const recipe = getRecipe(recipeId);
  if (!recipe) return false;
  if (state.state !== "idle") return false;

  state.state = "cooking";
  state.selectedRecipe = recipeId;
  state.timer = 0;
  return true;
}

/**
 * Advance the cooking timer. Returns the new state and timer values.
 */
export function tickCooking(
  state: CookingState,
  timer: number,
  deltaMs: number,
  cookTime: number,
): { state: CookingState; timer: number } {
  if (state !== "cooking") return { state, timer };

  const newTimer = timer + deltaMs;
  if (newTimer >= cookTime) {
    return { state: "done", timer: newTimer };
  }
  return { state: "cooking", timer: newTimer };
}

/**
 * Complete a cook: remove ingredients from inventory and add the result.
 * Returns true on success, false if ingredients are missing or no space.
 */
export function completeCooking(
  recipeId: string | null,
  inventory: InventoryComponent,
): boolean {
  if (!recipeId) return false;
  const recipe = getRecipe(recipeId);
  if (!recipe) return false;

  // Verify ingredients still present (guard against race conditions)
  for (const ingredient of recipe.ingredients) {
    if (countItem(inventory, ingredient.itemId) < ingredient.quantity) return false;
  }
  if (!hasSpaceFor(inventory, recipe.resultItemId, recipe.resultQuantity)) {
    return false;
  }

  // Remove ingredients
  for (const ingredient of recipe.ingredients) {
    removeItem(inventory, ingredient.itemId, ingredient.quantity);
  }

  // Add result
  addItem(inventory, recipe.resultItemId, recipe.resultQuantity);
  return true;
}

/**
 * Consume a food item, restoring energy and removing it from inventory.
 * Returns true if the item was consumed, false otherwise.
 */
export function consumeFood(
  stats: StatsComponent,
  inventory: InventoryComponent,
  itemId: ItemId,
): boolean {
  const energyRestore = FOOD_ENERGY[itemId];
  if (energyRestore === undefined) return false;
  if (countItem(inventory, itemId) < 1) return false;

  removeItem(inventory, itemId, 1);
  stats.energy = Math.min(stats.energy + energyRestore, stats.maxEnergy);
  return true;
}

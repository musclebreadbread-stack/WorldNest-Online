import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { CookingComponent } from "../components/CookingComponent";
import type { InventoryComponent } from "../components/InventoryComponent";
import type { StatsComponent } from "../components/StatsComponent";
import {
  canCook,
  completeCooking,
  consumeFood,
  startCooking,
  tickCooking,
} from "../cooking";
import { getRecipe } from "../cooking/cookingDefinitions";

/**
 * CookingSystem processes the cooking state machine for entities.
 *
 * On a `requestedCook` from the HUD:
 * - Validates that the recipe exists and the player has ingredients
 * - Starts the cooking timer
 * - On timer completion: removes ingredients and adds the result item
 *
 * On a `requestedConsume` from the HUD:
 * - Applies the energy restoration via `consumeFood`
 *
 * Terminal states (done/failed) reset to idle after one frame so the HUD can
 * read the result once and the system continues cleanly.
 */
export class CookingSystem extends System {
  constructor() {
    super(["cooking", "inventory", "stats"]);
  }

  update(entities: Entity[], deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    for (const entity of entities) {
      const cooking = entity.getComponent<CookingComponent>("cooking")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;
      const stats = entity.getComponent<StatsComponent>("stats")!;

      // Handle consume request (independent of cooking state)
      if (cooking.requestedConsume !== null) {
        consumeFood(stats, inventory, cooking.requestedConsume);
        cooking.requestedConsume = null;
        cooking.version++;
      }

      // Handle cook request
      if (cooking.requestedCook !== null) {
        const recipeId = cooking.requestedCook;
        cooking.requestedCook = null;

        if (canCook(inventory, recipeId)) {
          startCooking(cooking, recipeId);
          cooking.version++;
        } else {
          cooking.state = "failed";
          cooking.version++;
        }
      }

      // Advance timer for active cooking
      if (cooking.state === "cooking" && cooking.selectedRecipe !== null) {
        const recipe = getRecipe(cooking.selectedRecipe);
        if (recipe) {
          const result = tickCooking(
            cooking.state,
            cooking.timer,
            deltaMs,
            recipe.cookTimeMs,
          );
          if (result.state !== cooking.state) {
            cooking.version++;

            if (result.state === "done") {
              const success = completeCooking(cooking.selectedRecipe, inventory);
              if (!success) {
                cooking.state = "failed";
              } else {
                cooking.state = "done";
              }
            } else {
              cooking.state = result.state;
            }
          }
          cooking.timer = result.timer;
        }
      }

      // Reset terminal states back to idle after one frame
      if (cooking.state === "done" || cooking.state === "failed") {
        cooking.state = "idle";
        cooking.selectedRecipe = null;
        cooking.timer = 0;
        cooking.version++;
      }
    }
  }
}

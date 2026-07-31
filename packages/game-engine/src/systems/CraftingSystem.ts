import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import type { CraftingComponent } from "../components/CraftingComponent";
import type { InventoryComponent } from "../components/InventoryComponent";
import { canCraft, completeCraft, startCraft, tickCraft } from "../crafting";
import { getCraftingRecipe } from "../crafting/craftingDefinitions";

/**
 * CraftingSystem processes the crafting state machine for entities.
 *
 * On a `requestedCraft` from the HUD:
 * - Validates that the recipe exists, station matches, and player has ingredients
 * - Starts the crafting timer
 * - On timer completion: removes ingredients and adds the result item
 *
 * Terminal states (done/failed) reset to idle after one frame so the HUD can
 * read the result once and the system continues cleanly.
 */
export class CraftingSystem extends System {
  /** Listener called on successful craft completion. */
  private onCraftComplete?: () => void;

  constructor(onCraftComplete?: () => void) {
    super(["crafting", "inventory"]);
    this.onCraftComplete = onCraftComplete;
  }

  update(entities: Entity[], deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    for (const entity of entities) {
      const crafting = entity.getComponent<CraftingComponent>("crafting")!;
      const inventory = entity.getComponent<InventoryComponent>("inventory")!;

      // Reset terminal states back to idle after one frame
      if (crafting.state === "done" || crafting.state === "failed") {
        crafting.state = "idle";
        crafting.selectedRecipe = null;
        crafting.timer = 0;
        crafting.version++;
        continue;
      }

      // Handle craft request
      if (crafting.requestedCraft !== null) {
        const recipeId = crafting.requestedCraft;
        crafting.requestedCraft = null;

        if (canCraft(inventory, recipeId, crafting.station)) {
          startCraft(crafting, recipeId);
          crafting.version++;
        } else {
          crafting.state = "failed";
          crafting.version++;
        }
      }

      // Advance timer for active crafting
      if (crafting.state === "crafting" && crafting.selectedRecipe !== null) {
        const recipe = getCraftingRecipe(crafting.selectedRecipe);
        if (recipe) {
          const result = tickCraft(
            crafting.state,
            crafting.timer,
            deltaMs,
            recipe.craftTimeMs,
          );
          if (result.state !== crafting.state) {
            crafting.version++;

            if (result.state === "done") {
              const success = completeCraft(crafting.selectedRecipe, inventory);
              if (!success) {
                crafting.state = "failed";
              } else {
                crafting.state = "done";
                this.onCraftComplete?.();
              }
            } else {
              crafting.state = result.state;
            }
          }
          crafting.timer = result.timer;
        }
      }
    }
  }
}

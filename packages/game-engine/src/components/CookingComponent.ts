import type { ItemId } from "@worldnest/shared";
import { Component } from "../ecs/Component";
import type { CookingState } from "../cooking/cookingState";

/**
 * Cooking state machine for an entity. Tracks the current phase of a cooking
 * attempt, the selected recipe, and any pending requests from the HUD.
 *
 * Pure data by design: all state transitions live in `cooking/cookingOps.ts`
 * and `systems/CookingSystem.ts`.
 */
export class CookingComponent extends Component {
  /** Current phase of the cooking state machine. */
  public state: CookingState;
  /** Currently selected recipe id, or null when none is chosen. */
  public selectedRecipe: string | null;
  /** Milliseconds elapsed in the current cooking phase. */
  public timer: number;
  /** HUD request: start cooking a recipe by id. Consumed next frame. */
  public requestedCook: string | null;
  /** HUD request: consume a food item by id. Consumed next frame. */
  public requestedConsume: ItemId | null;
  /** Bumped on every state change so the UI can detect transitions cheaply. */
  public version: number;

  constructor() {
    super("cooking");
    this.state = "idle";
    this.selectedRecipe = null;
    this.timer = 0;
    this.requestedCook = null;
    this.requestedConsume = null;
    this.version = 0;
  }
}

import { Component } from "../ecs/Component";
import type { CraftingState } from "../crafting/craftingState";
import type { CraftingStation } from "../crafting/craftingDefinitions";

/**
 * Crafting state machine for an entity. Tracks the current phase of a craft
 * attempt, the selected recipe, station, and any pending requests from the HUD.
 *
 * Pure data by design: all state transitions live in `crafting/craftingOps.ts`
 * and `systems/CraftingSystem.ts`.
 */
export class CraftingComponent extends Component {
  /** Current phase of the crafting state machine. */
  public state: CraftingState;
  /** Currently selected recipe id, or null when none is chosen. */
  public selectedRecipe: string | null;
  /** Milliseconds elapsed in the current crafting phase. */
  public timer: number;
  /** What station the player currently has access to. */
  public station: CraftingStation;
  /** HUD request: start crafting a recipe by id. Consumed next frame. */
  public requestedCraft: string | null;
  /** Bumped on every state change so the UI can detect transitions cheaply. */
  public version: number;

  constructor() {
    super("crafting");
    this.state = "idle";
    this.selectedRecipe = null;
    this.timer = 0;
    this.station = "hand";
    this.requestedCraft = null;
    this.version = 0;
  }
}

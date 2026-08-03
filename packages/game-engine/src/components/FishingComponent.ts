import type { ItemId } from "@worldnest/shared";
import { Component } from "../ecs/Component";
import type { FishingState } from "../fishing";
import type { Biome } from "../world/Biomes";

/**
 * Fishing state machine for an entity. Tracks the current phase of a fishing
 * attempt, timing information, and the item that will be awarded on success.
 *
 * Pure data by design: all state transitions live in `fishing/fishingOps.ts`
 * and `systems/FishingSystem.ts`.
 */
export class FishingComponent extends Component {
  /** Current phase of the fishing state machine. */
  public state: FishingState;
  /** Milliseconds elapsed in the current state. */
  public timer: number;
  /** Milliseconds until a fish bites (randomised per cast). */
  public biteTime: number;
  /** Biome stored at cast-time for the catch roll at reel-time. */
  public catchBiome: Biome | null;
  /** Item the player received on a successful reel-in (set at reel-time). */
  public catchItemId: ItemId | null;
  /** Bumped on every state change so the UI can detect transitions cheaply. */
  public version: number;

  constructor() {
    super("fishing");
    this.state = "idle";
    this.timer = 0;
    this.biteTime = 0;
    this.catchBiome = null;
    this.catchItemId = null;
    this.version = 0;
  }
}

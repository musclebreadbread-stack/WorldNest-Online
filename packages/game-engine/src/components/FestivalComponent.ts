import { Component } from "../ecs/Component";

/**
 * Tracks the active seasonal festival and claimed rewards for a player.
 *
 * Pure data by design: every mutation lives in `festivals/festivalOps.ts`
 * and `systems/FestivalSystem.ts`. `version` is bumped on every state
 * change so the UI layer can detect updates without deep-comparing sets.
 */
export class FestivalComponent extends Component {
  /** The id of the currently active festival, or null if none. */
  public activeFestival: string | null;
  /**
   * Stores cycle keys (festivalId:cycleNumber) to prevent double-claiming
   * rewards within the same season cycle.
   */
  public claimedRewards: Set<string>;
  /** Set by the HUD to request claiming a festival reward. */
  public requestedClaim: string | null;
  /** Bumped on every accepted state change. */
  public version: number;

  constructor() {
    super("festival");
    this.activeFestival = null;
    this.claimedRewards = new Set();
    this.requestedClaim = null;
    this.version = 0;
  }
}

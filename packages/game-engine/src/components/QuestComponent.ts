import { Component } from "../ecs/Component";

/** Where a quest is in its life: offered, being worked on, or finished. */
export type QuestState = "available" | "active" | "completed";

/** One quest's own state. `progress` is measured against `objectiveTarget`. */
export interface QuestEntry {
  state: QuestState;
  progress: number;
  /**
   * Structure count captured when a `build` objective is accepted.
   * `objectiveProgress` subtracts it so only fences raised _after_ the quest
   * was taken on count toward the objective. Always 0 for non-build objectives.
   */
  baseline: number;
}

/**
 * Every quest an entity knows about, plus the request fields React writes through
 * its injected callbacks (decision D13).
 *
 * Only quests the player has actually been offered appear in `entries`, so an
 * untouched save is an empty object — which is also exactly what the persistence
 * layer stores. `QuestSystem` is the only writer: the HUD raises `requestedOffer`
 * or `requestedTurnIn` and the system consumes it on the next frame.
 */
export class QuestComponent extends Component {
  public entries: Record<string, QuestEntry>;
  /** Quest the HUD asked to take on, usually from a dialogue option. */
  public requestedOffer: string | null;
  /** Quest the HUD asked to hand in. */
  public requestedTurnIn: string | null;
  /**
   * Requests that were turned down — an unmet objective, a full backpack, a
   * quest already taken. Bumped instead of `version`, so the HUD can tell
   * "refused" from "nothing asked".
   */
  public refusals: number;
  /** Bumped by every accepted change, so the HUD can publish without diffing. */
  public version: number;

  constructor() {
    super("quest");
    this.entries = {};
    this.requestedOffer = null;
    this.requestedTurnIn = null;
    this.refusals = 0;
    this.version = 0;
  }
}

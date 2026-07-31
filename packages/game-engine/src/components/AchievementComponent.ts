import { Component } from "../ecs/Component";

/**
 * Tracks which achievements a player has unlocked and pending rewards.
 *
 * Pure data by design: every mutation lives in `achievements/achievementOps.ts`.
 * `version` is bumped by those operations so the UI layer can detect changes
 * without deep-comparing the sets every frame.
 */
export class AchievementComponent extends Component {
  /** Achievement ids the player has unlocked. */
  public unlocked: Set<string>;
  /** Achievement id whose reward has not yet been paid out, or null. */
  public pendingReward: string | null;
  /** Bumped by every accepted change. */
  public version: number;
  /** Lifetime fish caught total (not reset on spend). */
  public totalFishCaught: number;
  /** Lifetime quests completed total. */
  public totalQuestsCompleted: number;

  constructor() {
    super("achievement");
    this.unlocked = new Set();
    this.pendingReward = null;
    this.version = 0;
    this.totalFishCaught = 0;
    this.totalQuestsCompleted = 0;
  }
}

import { Component } from "../ecs/Component";
import type { MissionEntry } from "../missions/missionOps";

/**
 * Tracks a player's active missions, daily streak, and refresh state.
 *
 * Pure data. Logic lives in `missions/missionOps.ts` and the system in
 * `MissionSystem`. The HUD writes `requestedClaim` and the system consumes it.
 */
export class MissionComponent extends Component {
  /** Currently active mission entries keyed by mission id. */
  public activeMissions: Record<string, MissionEntry>;
  /** Consecutive days the player has completed a daily mission. */
  public dailyStreak: number;
  /** Day number when the last daily mission was completed. */
  public lastCompletedDay: number;
  /** Day number when daily missions were last refreshed. */
  public lastRefreshDay: number;
  /** Week number when weekly missions were last refreshed. */
  public lastRefreshWeek: number;
  /** Weekly missions completed this week. */
  public weeklyProgress: number;
  /** Bumped by every accepted change for HUD change detection. */
  public version: number;
  /** Mission id the HUD wants to claim a reward for, or null. */
  public requestedClaim: string | null;

  constructor() {
    super("mission");
    this.activeMissions = {};
    this.dailyStreak = 0;
    this.lastCompletedDay = -1;
    this.lastRefreshDay = -1;
    this.lastRefreshWeek = -1;
    this.weeklyProgress = 0;
    this.version = 0;
    this.requestedClaim = null;
  }
}

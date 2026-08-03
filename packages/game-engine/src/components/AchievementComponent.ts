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
  /** Lifetime coins earned (monotonically increasing, never decremented). */
  public totalCoinsEarned: number;
  /**
   * Last observed wallet.coins value. Used by AchievementSystem to detect
   * coin increases from any source (selling, quest rewards, festival rewards,
   * collection rewards) and add the delta to totalCoinsEarned.
   */
  public lastKnownCoins: number;
  /** Lifetime animals tamed total. */
  public totalAnimalsTamed: number;
  /** Lifetime crafts completed total. */
  public totalCraftsCompleted: number;
  /** Lifetime rhythm perfect hit count. */
  public totalRhythmPerfects: number;
  /** Highest single-song score achieved. */
  public bestRhythmScore: number;
  /** Highest mount bond level achieved (-1 if never mounted). */
  public highestMountBondLevel: number;
  /** Total water tiles traversed by boat. */
  public totalWaterTilesTraversed: number;
  /** Highest friendship level achieved (0-4). */
  public highestFriendshipLevel: number;
  /** Total gifts given to NPCs. */
  public totalGiftsGiven: number;

  constructor() {
    super("achievement");
    this.unlocked = new Set();
    this.pendingReward = null;
    this.version = 0;
    this.totalFishCaught = 0;
    this.totalQuestsCompleted = 0;
    this.totalCoinsEarned = 0;
    this.lastKnownCoins = 0;
    this.totalAnimalsTamed = 0;
    this.totalCraftsCompleted = 0;
    this.totalRhythmPerfects = 0;
    this.bestRhythmScore = 0;
    this.highestMountBondLevel = -1;
    this.totalWaterTilesTraversed = 0;
    this.highestFriendshipLevel = 0;
    this.totalGiftsGiven = 0;
  }
}

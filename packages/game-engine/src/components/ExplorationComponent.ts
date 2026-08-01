import { Component } from "../ecs/Component";
import type { Biome } from "../world/Biomes";

/**
 * Tracks a player's exploration progress: biome discoveries, landmark visits,
 * and map completion.
 *
 * Pure data. The logic lives in `exploration/explorationOps.ts` and the
 * system in `ExplorationSystem`.
 */
export class ExplorationComponent extends Component {
  /** Biomes the player has visited. */
  public discoveredBiomes: Set<Biome>;
  /** Landmark ids the player has found. */
  public discoveredLandmarks: Set<string>;
  /** Number of unique map tiles the player has walked on. */
  public mapTilesExplored: number;
  /** Total map tiles available for exploration. */
  public totalMapTiles: number;
  /** Milestone reward keys that have been claimed. */
  public rewardsClaimed: Set<string>;
  /** Monotonically increasing version for change detection. */
  public version: number;
  /** Pending biome discovery request (set externally, consumed by system). */
  public pendingBiomeDiscover: Biome | null;
  /** Pending landmark discovery request (set externally, consumed by system). */
  public pendingLandmarkDiscover: string | null;

  constructor(totalMapTiles = 1024) {
    super("exploration");
    this.discoveredBiomes = new Set();
    this.discoveredLandmarks = new Set();
    this.mapTilesExplored = 0;
    this.totalMapTiles = totalMapTiles;
    this.rewardsClaimed = new Set();
    this.version = 0;
    this.pendingBiomeDiscover = null;
    this.pendingLandmarkDiscover = null;
  }
}

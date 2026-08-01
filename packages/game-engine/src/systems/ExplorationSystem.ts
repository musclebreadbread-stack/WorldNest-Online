import type { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { ExplorationComponent } from "../components/ExplorationComponent";
import { PositionComponent } from "../components/PositionComponent";
import { WalletComponent } from "../components/WalletComponent";
import type { Biome } from "../world/Biomes";
import {
  BIOME_DISCOVERY_REWARDS,
  LANDMARK_DEFINITIONS,
} from "../exploration/explorationDefinitions";
import {
  discoverBiome,
  discoverLandmark,
  getExplorationReward,
  getNextMilestoneKey,
  recordTilesExplored,
} from "../exploration/explorationOps";
import type { BiomeAtTile } from "./FishingSystem";

/** Distance (in tiles) at which a landmark is considered discovered. */
const LANDMARK_PROXIMITY = 2;

/**
 * ExplorationSystem detects biome changes and landmark proximity each frame,
 * tracking the player's exploration progress and paying out rewards.
 *
 * Requires: exploration, position, wallet.
 */
export class ExplorationSystem extends System {
  private biomeAtTile: BiomeAtTile;
  /** Track last known tile per entity to avoid re-processing same position. */
  private lastTile: Map<string, { x: number; y: number }>;

  constructor(biomeAtTile: BiomeAtTile) {
    super(["exploration", "position", "wallet"]);
    this.biomeAtTile = biomeAtTile;
    this.lastTile = new Map();
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const exploration = entity.getComponent<ExplorationComponent>("exploration")!;
      const position = entity.getComponent<PositionComponent>("position")!;
      const wallet = entity.getComponent<WalletComponent>("wallet")!;

      const tileX = Math.floor(position.x);
      const tileY = Math.floor(position.y);

      // Consume pending requests
      if (exploration.pendingBiomeDiscover !== null) {
        this.handleBiomeDiscovery(
          exploration,
          wallet,
          exploration.pendingBiomeDiscover,
        );
        exploration.pendingBiomeDiscover = null;
      }
      if (exploration.pendingLandmarkDiscover !== null) {
        this.handleLandmarkDiscovery(
          exploration,
          wallet,
          exploration.pendingLandmarkDiscover,
        );
        exploration.pendingLandmarkDiscover = null;
      }

      // Check if we moved to a new tile
      const last = this.lastTile.get(entity.id);
      if (last && last.x === tileX && last.y === tileY) continue;
      this.lastTile.set(entity.id, { x: tileX, y: tileY });

      // Record tile explored
      recordTilesExplored(exploration, 1);

      // Detect biome at current position
      const biome = this.biomeAtTile(tileX, tileY);
      this.handleBiomeDiscovery(exploration, wallet, biome);

      // Check landmark proximity
      this.checkLandmarkProximity(exploration, wallet, tileX, tileY);

      // Check milestone rewards
      this.checkMilestoneRewards(exploration, wallet);
    }
  }

  private handleBiomeDiscovery(
    exploration: ExplorationComponent,
    wallet: WalletComponent,
    biome: Biome,
  ): void {
    if (discoverBiome(exploration, biome)) {
      wallet.coins += BIOME_DISCOVERY_REWARDS[biome];
    }
  }

  private handleLandmarkDiscovery(
    exploration: ExplorationComponent,
    wallet: WalletComponent,
    landmarkId: string,
  ): void {
    const landmark = LANDMARK_DEFINITIONS.find((l) => l.id === landmarkId);
    if (landmark && discoverLandmark(exploration, landmarkId)) {
      wallet.coins += landmark.rewardCoins;
    }
  }

  private checkLandmarkProximity(
    exploration: ExplorationComponent,
    wallet: WalletComponent,
    tileX: number,
    tileY: number,
  ): void {
    for (const landmark of LANDMARK_DEFINITIONS) {
      if (exploration.discoveredLandmarks.has(landmark.id)) continue;
      const dx = Math.abs(tileX - landmark.tileX);
      const dy = Math.abs(tileY - landmark.tileY);
      if (dx <= LANDMARK_PROXIMITY && dy <= LANDMARK_PROXIMITY) {
        discoverLandmark(exploration, landmark.id);
        wallet.coins += landmark.rewardCoins;
      }
    }
  }

  private checkMilestoneRewards(
    exploration: ExplorationComponent,
    wallet: WalletComponent,
  ): void {
    const milestoneKey = getNextMilestoneKey(exploration, exploration.rewardsClaimed);
    if (milestoneKey) {
      const reward = getExplorationReward(exploration, exploration.rewardsClaimed);
      if (reward > 0) {
        wallet.coins += reward;
        exploration.rewardsClaimed.add(milestoneKey);
        exploration.version++;
      }
    }
  }
}

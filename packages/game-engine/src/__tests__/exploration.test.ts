import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../ecs/Entity";
import { ExplorationComponent } from "../components/ExplorationComponent";
import { PositionComponent } from "../components/PositionComponent";
import { WalletComponent } from "../components/WalletComponent";
import { Biome } from "../world/Biomes";
import {
  discoverBiome,
  discoverLandmark,
  getMapCompletion,
  getExplorationReward,
  getNextMilestoneKey,
  recordTilesExplored,
} from "../exploration/explorationOps";
import {
  LANDMARK_DEFINITIONS,
  BIOME_DISCOVERY_REWARDS,
} from "../exploration/explorationDefinitions";
import { ExplorationSystem } from "../systems/ExplorationSystem";
import { checkCondition } from "../achievements/achievementOps";
import type { AchievementSource } from "../achievements/achievementDefinitions";

function createExplorationState(totalTiles = 1024) {
  return {
    discoveredBiomes: new Set<Biome>(),
    discoveredLandmarks: new Set<string>(),
    mapTilesExplored: 0,
    totalMapTiles: totalTiles,
    version: 0,
  };
}

function createExplorer(x = 0, y = 0) {
  const exploration = new ExplorationComponent();
  const position = new PositionComponent(x, y);
  const wallet = new WalletComponent(0);
  const entity = new Entity("explorer");
  entity.addComponent(exploration).addComponent(position).addComponent(wallet);
  return { entity, exploration, position, wallet };
}

describe("explorationOps", () => {
  describe("discoverBiome", () => {
    it("returns true for a new biome, false for repeat", () => {
      const state = createExplorationState();
      expect(discoverBiome(state, Biome.TUNDRA)).toBe(true);
      expect(state.discoveredBiomes.has(Biome.TUNDRA)).toBe(true);
      expect(state.version).toBe(1);
      expect(discoverBiome(state, Biome.TUNDRA)).toBe(false);
      expect(state.version).toBe(1);
    });

    it("tracks multiple biomes independently", () => {
      const state = createExplorationState();
      discoverBiome(state, Biome.TUNDRA);
      discoverBiome(state, Biome.DESERT);
      expect(state.discoveredBiomes.size).toBe(2);
    });
  });

  describe("discoverLandmark", () => {
    it("returns true for a new landmark, false for repeat", () => {
      const state = createExplorationState();
      expect(discoverLandmark(state, "tundra_peak")).toBe(true);
      expect(state.discoveredLandmarks.has("tundra_peak")).toBe(true);
      expect(state.version).toBe(1);
      expect(discoverLandmark(state, "tundra_peak")).toBe(false);
      expect(state.version).toBe(1);
    });
  });

  describe("getMapCompletion", () => {
    it("returns correct percentage", () => {
      const state = createExplorationState(100);
      expect(getMapCompletion(state)).toBe(0);
      state.mapTilesExplored = 25;
      expect(getMapCompletion(state)).toBe(25);
      state.mapTilesExplored = 100;
      expect(getMapCompletion(state)).toBe(100);
      state.mapTilesExplored = 150;
      expect(getMapCompletion(state)).toBe(100);
    });

    it("handles zero totalMapTiles", () => {
      expect(getMapCompletion(createExplorationState(0))).toBe(0);
    });
  });

  describe("getExplorationReward", () => {
    it("returns correct coins per milestone", () => {
      const state = createExplorationState(100);
      const claimed = new Set<string>();
      state.mapTilesExplored = 25;
      expect(getExplorationReward(state, claimed)).toBe(25);
      claimed.add("milestone_25");
      state.mapTilesExplored = 50;
      expect(getExplorationReward(state, claimed)).toBe(50);
      claimed.add("milestone_50");
      state.mapTilesExplored = 75;
      expect(getExplorationReward(state, claimed)).toBe(75);
      claimed.add("milestone_75");
      state.mapTilesExplored = 100;
      expect(getExplorationReward(state, claimed)).toBe(100);
      claimed.add("milestone_100");
      expect(getExplorationReward(state, claimed)).toBe(0);
    });

    it("returns 0 when no milestone reached", () => {
      const state = createExplorationState(100);
      state.mapTilesExplored = 10;
      expect(getExplorationReward(state, new Set())).toBe(0);
    });
  });

  describe("getNextMilestoneKey", () => {
    it("returns milestone key or null", () => {
      const state = createExplorationState(100);
      state.mapTilesExplored = 25;
      expect(getNextMilestoneKey(state, new Set())).toBe("milestone_25");
      state.mapTilesExplored = 10;
      expect(getNextMilestoneKey(state, new Set())).toBeNull();
    });
  });

  describe("recordTilesExplored", () => {
    it("increments tiles and caps at total", () => {
      const state = createExplorationState(100);
      expect(recordTilesExplored(state, 5)).toBe(true);
      expect(state.mapTilesExplored).toBe(5);
      recordTilesExplored(state, 150);
      expect(state.mapTilesExplored).toBe(100);
    });

    it("returns false for zero or negative count", () => {
      const state = createExplorationState(100);
      expect(recordTilesExplored(state, 0)).toBe(false);
      expect(recordTilesExplored(state, -1)).toBe(false);
    });
  });
});

describe("ExplorationSystem", () => {
  let system: ExplorationSystem;
  let currentBiome: Biome;

  beforeEach(() => {
    currentBiome = Biome.GRASSLAND;
    system = new ExplorationSystem(() => currentBiome);
  });

  it("should require exploration, position, and wallet", () => {
    expect(system.requiredComponents).toEqual(["exploration", "position", "wallet"]);
  });

  it("should discover biome when entity moves", () => {
    const { entity, exploration, wallet } = createExplorer(5, 5);
    system.update([entity], 1 / 60);
    expect(exploration.discoveredBiomes.has(Biome.GRASSLAND)).toBe(true);
    expect(wallet.coins).toBe(BIOME_DISCOVERY_REWARDS[Biome.GRASSLAND]);
  });

  it("should not re-discover same biome on same tile", () => {
    const { entity, wallet } = createExplorer(5, 5);
    system.update([entity], 1 / 60);
    const coinsAfter = wallet.coins;
    system.update([entity], 1 / 60);
    expect(wallet.coins).toBe(coinsAfter);
  });

  it("should discover new biome when biome changes", () => {
    const { entity, exploration, position, wallet } = createExplorer(5, 5);
    system.update([entity], 1 / 60);
    currentBiome = Biome.DESERT;
    position.x = 10;
    system.update([entity], 1 / 60);
    expect(exploration.discoveredBiomes.has(Biome.DESERT)).toBe(true);
    expect(wallet.coins).toBe(
      BIOME_DISCOVERY_REWARDS[Biome.GRASSLAND] + BIOME_DISCOVERY_REWARDS[Biome.DESERT],
    );
  });

  it("should discover landmark by proximity", () => {
    const landmark = LANDMARK_DEFINITIONS[0]!;
    const { entity, exploration, wallet } = createExplorer(
      landmark.tileX + 1,
      landmark.tileY,
    );
    system.update([entity], 1 / 60);
    expect(exploration.discoveredLandmarks.has(landmark.id)).toBe(true);
    expect(wallet.coins).toBeGreaterThan(0);
  });

  it("should not discover landmark when too far away", () => {
    const landmark = LANDMARK_DEFINITIONS[0]!;
    const { entity, exploration } = createExplorer(
      landmark.tileX + 10,
      landmark.tileY + 10,
    );
    system.update([entity], 1 / 60);
    expect(exploration.discoveredLandmarks.has(landmark.id)).toBe(false);
  });

  it("should record tiles explored when moving", () => {
    const { entity, exploration, position } = createExplorer(0, 0);
    system.update([entity], 1 / 60);
    expect(exploration.mapTilesExplored).toBe(1);
    position.x = 1;
    system.update([entity], 1 / 60);
    expect(exploration.mapTilesExplored).toBe(2);
  });

  it("should consume pending biome discovery request", () => {
    const { entity, exploration, wallet } = createExplorer(5, 5);
    exploration.pendingBiomeDiscover = Biome.TUNDRA;
    system.update([entity], 1 / 60);
    expect(exploration.pendingBiomeDiscover).toBeNull();
    expect(exploration.discoveredBiomes.has(Biome.TUNDRA)).toBe(true);
    expect(wallet.coins).toBeGreaterThanOrEqual(BIOME_DISCOVERY_REWARDS[Biome.TUNDRA]);
  });

  it("should consume pending landmark discovery request", () => {
    const { entity, exploration, wallet } = createExplorer(5, 5);
    exploration.pendingLandmarkDiscover = "taiga_grove";
    system.update([entity], 1 / 60);
    expect(exploration.pendingLandmarkDiscover).toBeNull();
    expect(exploration.discoveredLandmarks.has("taiga_grove")).toBe(true);
    expect(wallet.coins).toBeGreaterThan(0);
  });

  it("should pay milestone rewards", () => {
    const { entity, exploration, wallet } = createExplorer(0, 0);
    exploration.totalMapTiles = 4;
    system.update([entity], 1 / 60);
    expect(exploration.rewardsClaimed.has("milestone_25")).toBe(true);
    expect(wallet.coins).toBeGreaterThan(BIOME_DISCOVERY_REWARDS[Biome.GRASSLAND]);
  });
});

describe("Exploration achievements integration", () => {
  it("should check exploration conditions", () => {
    const source: AchievementSource = {
      itemCount: () => 0,
      donationCount: 0,
      structureCount: 0,
      questCompletionCount: 0,
      fishCaughtCount: 0,
      totalCoinsEarned: 0,
      animalsTamedCount: 0,
      quizStreak: 0,
      housingHappiness: 0,
      craftCount: 0,
      rhythmPerfectCount: 0,
      rhythmScore: 0,
      mountBondLevel: -1,
      waterTilesTraversed: 0,
      highestFriendshipLevel: 0,
      totalGiftsGiven: 0,
      biomesDiscovered: 3,
      landmarksDiscovered: 1,
      mapCompletionPercent: 50,
      isCategoryComplete: () => false,
    };
    expect(checkCondition({ kind: "biomes_discovered", count: 1 }, source)).toBe(true);
    expect(checkCondition({ kind: "biomes_discovered", count: 6 }, source)).toBe(false);
    expect(checkCondition({ kind: "landmarks_discovered", count: 1 }, source)).toBe(
      true,
    );
    expect(checkCondition({ kind: "landmarks_discovered", count: 3 }, source)).toBe(
      false,
    );
    expect(checkCondition({ kind: "map_completion", percent: 50 }, source)).toBe(true);
    expect(checkCondition({ kind: "map_completion", percent: 75 }, source)).toBe(false);
  });
});

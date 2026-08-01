import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../ecs/Entity";
import { GardeningComponent } from "../components/GardeningComponent";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import { FlowerVariety } from "../gardening/gardeningDefinitions";
import {
  createArrangement,
  enterCompetition,
  harvestFlower,
  judgeCompetition,
  plantFlower,
  scoreArrangement,
  waterGarden,
} from "../gardening/gardeningOps";
import { GardeningSystem } from "../systems/GardeningSystem";
import { addItem } from "../inventory";
import { checkCondition } from "../achievements/achievementOps";
import type { AchievementSource } from "../achievements/achievementDefinitions";
import type { GardeningState } from "../gardening/gardeningOps";

function createGardeningState(): GardeningState {
  return {
    gardenPlots: [],
    arrangements: [],
    competitionHistory: [],
    waterLevel: 0,
    lastWateredTime: 0,
    version: 0,
  };
}

function createGardener() {
  const gardening = new GardeningComponent();
  const inventory = new InventoryComponent(20);
  const wallet = new WalletComponent(100);
  const entity = new Entity("gardener");
  entity.addComponent(gardening).addComponent(inventory).addComponent(wallet);
  return { entity, gardening, inventory, wallet };
}

describe("gardeningOps", () => {
  describe("plantFlower", () => {
    it("plants a flower and increments version", () => {
      const state = createGardeningState();
      const result = plantFlower(state, FlowerVariety.ROSE, 1000, 8);
      expect(result).toBe(true);
      expect(state.gardenPlots).toHaveLength(1);
      expect(state.gardenPlots[0].flower).toBe(FlowerVariety.ROSE);
      expect(state.gardenPlots[0].plantedAt).toBe(1000);
      expect(state.version).toBe(1);
    });

    it("refuses to plant when at max plots", () => {
      const state = createGardeningState();
      for (let i = 0; i < 4; i++) {
        plantFlower(state, FlowerVariety.LILY, 1000, 4);
      }
      const result = plantFlower(state, FlowerVariety.ROSE, 1000, 4);
      expect(result).toBe(false);
      expect(state.gardenPlots).toHaveLength(4);
    });
  });

  describe("waterGarden", () => {
    it("increases water level and marks plots as watered", () => {
      const state = createGardeningState();
      plantFlower(state, FlowerVariety.TULIP, 1000, 8);
      const result = waterGarden(state, 2000);
      expect(result).toBe(true);
      expect(state.waterLevel).toBe(25);
      expect(state.lastWateredTime).toBe(2000);
      expect(state.gardenPlots[0].watered).toBe(true);
    });

    it("caps water level at max", () => {
      const state = createGardeningState();
      state.waterLevel = 90;
      waterGarden(state, 1000);
      expect(state.waterLevel).toBe(100);
    });
  });

  describe("harvestFlower", () => {
    it("harvests a mature watered flower", () => {
      const state = createGardeningState();
      plantFlower(state, FlowerVariety.SUNFLOWER, 0, 8);
      state.gardenPlots[0].watered = true;
      const result = harvestFlower(state, 0, 70_000);
      expect(result).toBe(FlowerVariety.SUNFLOWER);
      expect(state.gardenPlots).toHaveLength(0);
    });

    it("refuses to harvest immature flower", () => {
      const state = createGardeningState();
      plantFlower(state, FlowerVariety.ROSE, 0, 8);
      state.gardenPlots[0].watered = true;
      const result = harvestFlower(state, 0, 30_000);
      expect(result).toBeNull();
    });

    it("refuses to harvest unwatered flower", () => {
      const state = createGardeningState();
      plantFlower(state, FlowerVariety.LILY, 0, 8);
      const result = harvestFlower(state, 0, 70_000);
      expect(result).toBeNull();
    });

    it("returns null for invalid index", () => {
      const state = createGardeningState();
      expect(harvestFlower(state, 5, 1000)).toBeNull();
    });
  });

  describe("scoreArrangement", () => {
    it("scores based on flower beauty points", () => {
      const score = scoreArrangement(
        [FlowerVariety.ROSE, FlowerVariety.ROSE, FlowerVariety.ROSE],
        false,
      );
      // 3 roses = 30 base, single variety = no bonus
      expect(score).toBe(30);
    });

    it("applies variety bonus for multiple varieties", () => {
      const score = scoreArrangement(
        [FlowerVariety.ROSE, FlowerVariety.LILY, FlowerVariety.TULIP],
        false,
      );
      // 10 + 8 + 7 = 25 base, variety bonus = floor(25 * 1.5) = 37
      expect(score).toBe(37);
    });

    it("applies seasonal bonus", () => {
      const score = scoreArrangement(
        [FlowerVariety.ROSE, FlowerVariety.ROSE, FlowerVariety.ROSE],
        true,
      );
      // 30 base * 1.25 = 37.5 -> floor = 37
      expect(score).toBe(37);
    });

    it("applies both variety and seasonal bonuses", () => {
      const score = scoreArrangement(
        [FlowerVariety.SUNFLOWER, FlowerVariety.ROSE, FlowerVariety.LILY],
        true,
      );
      // 12 + 10 + 8 = 30, variety: floor(30 * 1.5) = 45, seasonal: floor(45 * 1.25) = 56
      expect(score).toBe(56);
    });
  });

  describe("createArrangement", () => {
    it("creates arrangement with correct flower count", () => {
      const state = createGardeningState();
      const result = createArrangement(
        state,
        [FlowerVariety.ROSE, FlowerVariety.LILY, FlowerVariety.TULIP],
        5000,
      );
      expect(result).not.toBeNull();
      expect(result!.flowers).toHaveLength(3);
      expect(state.arrangements).toHaveLength(1);
    });

    it("rejects wrong flower count", () => {
      const state = createGardeningState();
      const result = createArrangement(
        state,
        [FlowerVariety.ROSE, FlowerVariety.LILY],
        5000,
      );
      expect(result).toBeNull();
    });
  });

  describe("enterCompetition and judgeCompetition", () => {
    it("judges competition and determines tier", () => {
      expect(judgeCompetition(10).tier).toBe("bronze");
      expect(judgeCompetition(40).tier).toBe("silver");
      expect(judgeCompetition(60).tier).toBe("gold");
      expect(judgeCompetition(100).tier).toBe("gold");
    });

    it("enters competition with valid arrangement", () => {
      const state = createGardeningState();
      createArrangement(
        state,
        [FlowerVariety.SUNFLOWER, FlowerVariety.ROSE, FlowerVariety.LILY],
        1000,
      );
      const entry = enterCompetition(state, 0, 2000);
      expect(entry).not.toBeNull();
      expect(entry!.reward).toBeGreaterThan(0);
      expect(state.competitionHistory).toHaveLength(1);
    });

    it("returns null for invalid arrangement index", () => {
      const state = createGardeningState();
      expect(enterCompetition(state, 99, 1000)).toBeNull();
    });
  });
});

describe("GardeningSystem", () => {
  let system: GardeningSystem;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 0;
    system = new GardeningSystem(() => currentTime);
  });

  it("requires gardening, inventory, and wallet components", () => {
    expect(system.requiredComponents).toEqual(["gardening", "inventory", "wallet"]);
  });

  it("consumes pendingPlant and removes item from inventory", () => {
    const { entity, gardening, inventory } = createGardener();
    addItem(inventory, "rose", 5);
    gardening.pendingPlant = FlowerVariety.ROSE;
    system.update([entity], 1 / 60);
    expect(gardening.pendingPlant).toBeNull();
    expect(gardening.gardenPlots).toHaveLength(1);
  });

  it("does not plant if inventory lacks the flower", () => {
    const { entity, gardening } = createGardener();
    gardening.pendingPlant = FlowerVariety.ROSE;
    system.update([entity], 1 / 60);
    expect(gardening.gardenPlots).toHaveLength(0);
  });

  it("consumes pendingWater", () => {
    const { entity, gardening } = createGardener();
    gardening.pendingWater = true;
    system.update([entity], 1 / 60);
    expect(gardening.pendingWater).toBe(false);
    expect(gardening.waterLevel).toBe(25);
  });

  it("consumes pendingArrange, removes flowers, adds arrangement item", () => {
    const { entity, gardening, inventory } = createGardener();
    addItem(inventory, "rose", 2);
    addItem(inventory, "lily", 1);
    gardening.pendingArrange = [
      FlowerVariety.ROSE,
      FlowerVariety.ROSE,
      FlowerVariety.LILY,
    ];
    system.update([entity], 1 / 60);
    expect(gardening.pendingArrange).toBeNull();
    expect(gardening.arrangements).toHaveLength(1);
  });

  it("does not create arrangement if inventory lacks flowers", () => {
    const { entity, gardening, inventory } = createGardener();
    addItem(inventory, "rose", 1);
    gardening.pendingArrange = [
      FlowerVariety.ROSE,
      FlowerVariety.ROSE,
      FlowerVariety.LILY,
    ];
    system.update([entity], 1 / 60);
    expect(gardening.arrangements).toHaveLength(0);
  });

  it("consumes pendingCompete and awards coins", () => {
    const { entity, gardening, wallet } = createGardener();
    createArrangement(
      gardening,
      [FlowerVariety.SUNFLOWER, FlowerVariety.ROSE, FlowerVariety.LILY],
      0,
    );
    const initialCoins = wallet.coins;
    gardening.pendingCompete = 0;
    system.update([entity], 1 / 60);
    expect(gardening.pendingCompete).toBeNull();
    expect(wallet.coins).toBeGreaterThan(initialCoins);
    expect(gardening.competitionHistory).toHaveLength(1);
  });
});

describe("Gardening achievements integration", () => {
  it("checks garden_arrangements condition", () => {
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
      biomesDiscovered: 0,
      landmarksDiscovered: 0,
      mapCompletionPercent: 0,
      missionsCompleted: 0,
      missionStreak: 0,
      rareItemsBought: 0,
      shopsVisited: 0,
      gardenArrangements: 3,
      gardenCompetitionWins: 1,
      isCategoryComplete: () => false,
    };
    expect(checkCondition({ kind: "garden_arrangements", count: 1 }, source)).toBe(
      true,
    );
    expect(checkCondition({ kind: "garden_arrangements", count: 5 }, source)).toBe(
      false,
    );
    expect(checkCondition({ kind: "garden_competition_wins", count: 1 }, source)).toBe(
      true,
    );
    expect(checkCondition({ kind: "garden_competition_wins", count: 3 }, source)).toBe(
      false,
    );
  });
});

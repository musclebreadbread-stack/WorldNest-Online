import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import { CollectionComponent } from "../components/CollectionComponent";
import { QuestComponent } from "../components/QuestComponent";
import { AchievementComponent } from "../components/AchievementComponent";
import { addItem } from "../inventory/inventoryOps";
import { donate } from "../collection/collectionOps";
import {
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_IDS,
  getAchievement,
  type AchievementSource,
} from "../achievements/achievementDefinitions";
import {
  checkAchievement,
  checkCondition,
  getUnlockedCount,
  getPendingAchievements,
  unlockAchievement,
} from "../achievements/achievementOps";
import { AchievementSystem } from "../systems/AchievementSystem";

function emptySource(): AchievementSource {
  return {
    itemCount: () => 0,
    donationCount: 0,
    structureCount: 0,
    questCompletionCount: 0,
    fishCaughtCount: 0,
    totalCoinsEarned: 0,
    animalsTamedCount: 0,
    quizStreak: 0,
    isCategoryComplete: () => false,
  };
}

function createPlayer() {
  const achievement = new AchievementComponent();
  const inventory = new InventoryComponent();
  const wallet = new WalletComponent(0);
  const collection = new CollectionComponent();
  const quest = new QuestComponent();
  const entity = new Entity("player");
  entity
    .addComponent(achievement)
    .addComponent(inventory)
    .addComponent(wallet)
    .addComponent(collection)
    .addComponent(quest);
  return { entity, achievement, inventory, wallet, collection, quest };
}

describe("achievementDefinitions", () => {
  it("should define 8 achievements with valid keys and unique ids", () => {
    expect(ACHIEVEMENT_IDS).toHaveLength(11);
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(11);
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      expect(def.titleKey).toMatch(/^achievement\./);
      expect(def.descriptionKey).toMatch(/^achievement\./);
      expect(def.rewardCoins).toBeGreaterThan(0);
    }
  });

  it("should look up achievements by id", () => {
    expect(getAchievement("first_harvest")).toBeDefined();
    expect(getAchievement("nonexistent")).toBeUndefined();
  });
});

describe("checkCondition", () => {
  it("should check collect condition", () => {
    const source = { ...emptySource(), itemCount: () => 3 };
    expect(checkCondition({ kind: "collect", itemId: "wheat", count: 1 }, source)).toBe(
      true,
    );
    expect(
      checkCondition({ kind: "collect", itemId: "wheat", count: 1 }, emptySource()),
    ).toBe(false);
  });

  it("should check donate condition", () => {
    const source = { ...emptySource(), donationCount: 5 };
    expect(checkCondition({ kind: "donate", count: 5 }, source)).toBe(true);
    expect(checkCondition({ kind: "donate", count: 6 }, source)).toBe(false);
  });

  it("should check build condition", () => {
    const source = { ...emptySource(), structureCount: 10 };
    expect(checkCondition({ kind: "build", count: 10 }, source)).toBe(true);
    expect(checkCondition({ kind: "build", count: 11 }, source)).toBe(false);
  });

  it("should check quest condition", () => {
    const source = { ...emptySource(), questCompletionCount: 3 };
    expect(checkCondition({ kind: "quest", count: 3 }, source)).toBe(true);
    expect(checkCondition({ kind: "quest", count: 4 }, source)).toBe(false);
  });

  it("should check fish condition", () => {
    const source = { ...emptySource(), fishCaughtCount: 10 };
    expect(checkCondition({ kind: "fish", count: 10 }, source)).toBe(true);
    expect(checkCondition({ kind: "fish", count: 11 }, source)).toBe(false);
  });

  it("should check total_coins condition", () => {
    const source = { ...emptySource(), totalCoinsEarned: 200 };
    expect(checkCondition({ kind: "total_coins", amount: 200 }, source)).toBe(true);
    expect(checkCondition({ kind: "total_coins", amount: 201 }, source)).toBe(false);
  });

  it("should check category_complete condition", () => {
    const source = {
      ...emptySource(),
      donationCount: 5,
      isCategoryComplete: (id: string) => id === "gathering",
    };
    expect(
      checkCondition(
        { kind: "category_complete", categoryId: "gathering", donateCount: 5 },
        source,
      ),
    ).toBe(true);
    expect(
      checkCondition(
        { kind: "category_complete", categoryId: "gathering", donateCount: 6 },
        source,
      ),
    ).toBe(false);
    expect(
      checkCondition(
        { kind: "category_complete", categoryId: "fishing", donateCount: 5 },
        source,
      ),
    ).toBe(false);
  });
});

describe("checkAchievement", () => {
  it("should return true when condition is met and not unlocked", () => {
    const { achievement } = createPlayer();
    const def = getAchievement("first_harvest")!;
    const source = { ...emptySource(), itemCount: () => 1 };
    expect(checkAchievement(achievement, def, source)).toBe(true);
  });

  it("should return false when already unlocked", () => {
    const { achievement } = createPlayer();
    const def = getAchievement("first_harvest")!;
    achievement.unlocked.add("first_harvest");
    expect(
      checkAchievement(achievement, def, {
        ...emptySource(),
        itemCount: () => 1,
      }),
    ).toBe(false);
  });

  it("should return false when condition is not met", () => {
    const { achievement } = createPlayer();
    const def = getAchievement("first_harvest")!;
    expect(checkAchievement(achievement, def, emptySource())).toBe(false);
  });

  it("should require gathering complete for full_gathering", () => {
    const { achievement } = createPlayer();
    const def = getAchievement("full_gathering")!;
    const source = { ...emptySource(), donationCount: 5 };
    expect(checkAchievement(achievement, def, source)).toBe(false);
    expect(
      checkAchievement(achievement, def, {
        ...source,
        isCategoryComplete: (id: string) => id === "gathering",
      }),
    ).toBe(true);
  });
});

describe("unlockAchievement", () => {
  it("should add id to unlocked set and set pendingReward", () => {
    const { achievement } = createPlayer();
    expect(unlockAchievement(achievement, "first_harvest")).toBe(true);
    expect(achievement.unlocked.has("first_harvest")).toBe(true);
    expect(achievement.pendingReward).toBe("first_harvest");
    expect(achievement.version).toBe(1);
  });

  it("should be idempotent (refuse double unlock)", () => {
    const { achievement } = createPlayer();
    unlockAchievement(achievement, "first_harvest");
    expect(unlockAchievement(achievement, "first_harvest")).toBe(false);
    expect(achievement.version).toBe(1);
  });
});

describe("getUnlockedCount and getPendingAchievements", () => {
  it("should count unlocked achievements", () => {
    const { achievement } = createPlayer();
    expect(getUnlockedCount(achievement)).toBe(0);
    unlockAchievement(achievement, "first_harvest");
    unlockAchievement(achievement, "first_fish");
    expect(getUnlockedCount(achievement)).toBe(2);
  });

  it("should return definitions not yet unlocked", () => {
    const { achievement } = createPlayer();
    unlockAchievement(achievement, "first_harvest");
    const pending = getPendingAchievements(achievement);
    expect(pending.length).toBe(ACHIEVEMENT_DEFINITIONS.length - 1);
    expect(pending.find((d) => d.id === "first_harvest")).toBeUndefined();
  });
});

describe("AchievementSystem", () => {
  let system: AchievementSystem;

  beforeEach(() => {
    system = new AchievementSystem();
  });

  it("should require all five components", () => {
    expect(system.requiredComponents).toEqual([
      "achievement",
      "inventory",
      "wallet",
      "collection",
      "quest",
    ]);
  });

  it("should unlock first_harvest when wheat is in inventory", () => {
    const { entity, achievement, inventory } = createPlayer();
    addItem(inventory, "wheat", 1);
    system.update([entity], 1 / 60);
    expect(achievement.unlocked.has("first_harvest")).toBe(true);
  });

  it("should pay out reward on the next frame", () => {
    const { entity, achievement, inventory, wallet } = createPlayer();
    addItem(inventory, "wheat", 1);
    system.update([entity], 1 / 60);
    expect(achievement.pendingReward).toBe("first_harvest");
    system.update([entity], 1 / 60);
    expect(achievement.pendingReward).toBeNull();
    expect(wallet.coins).toBe(getAchievement("first_harvest")!.rewardCoins);
  });

  it("should unlock first_fish when totalFishCaught > 0", () => {
    const { entity, achievement } = createPlayer();
    achievement.totalFishCaught = 1;
    system.update([entity], 1 / 60);
    expect(achievement.unlocked.has("first_fish")).toBe(true);
  });

  it("should not double-unlock", () => {
    const { entity, achievement, inventory, wallet } = createPlayer();
    addItem(inventory, "wheat", 5);
    system.update([entity], 1 / 60);
    system.update([entity], 1 / 60);
    const coinsAfterPayout = wallet.coins;
    system.update([entity], 1 / 60);
    expect(wallet.coins).toBe(coinsAfterPayout);
    expect(achievement.version).toBe(1);
  });

  it("should unlock collector_5 when 5 items donated", () => {
    const { entity, achievement, inventory, collection } = createPlayer();
    const items = ["wood", "stone", "ore", "fiber", "flower"] as const;
    for (const item of items) {
      addItem(inventory, item, 1);
      donate(collection, inventory, item);
    }
    system.update([entity], 1 / 60);
    expect(achievement.unlocked.has("collector_5")).toBe(true);
  });

  it("should unlock quest_master with enough completed quests", () => {
    const { entity, achievement, quest } = createPlayer();
    quest.entries["q1"] = { state: "completed", progress: 1, baseline: 0 };
    quest.entries["q2"] = { state: "completed", progress: 1, baseline: 0 };
    quest.entries["q3"] = { state: "completed", progress: 1, baseline: 0 };
    for (let i = 0; i < 10; i++) system.update([entity], 1 / 60);
    expect(achievement.unlocked.has("quest_master")).toBe(true);
  });

  it("should use injected structure counter for builder_10", () => {
    const customSystem = new AchievementSystem(() => 5);
    const { entity, achievement } = createPlayer();
    for (let i = 0; i < 10; i++) customSystem.update([entity], 1 / 60);
    expect(achievement.unlocked.has("builder_10")).toBe(true);
  });

  it("should handle zero progress without errors", () => {
    const { entity, achievement } = createPlayer();
    system.update([entity], 1 / 60);
    expect(achievement.unlocked.size).toBe(0);
  });

  it("should accumulate totalCoinsEarned from wallet increases", () => {
    const { entity, achievement, wallet } = createPlayer();
    // Simulate selling items (external coin increase)
    wallet.coins += 100;
    system.update([entity], 1 / 60);
    expect(achievement.totalCoinsEarned).toBe(100);
    expect(achievement.lastKnownCoins).toBe(100);
  });

  it("should not decrease totalCoinsEarned when coins are spent", () => {
    const { entity, achievement, wallet } = createPlayer();
    wallet.coins += 150;
    system.update([entity], 1 / 60);
    // Spend coins (purchase)
    wallet.coins -= 50;
    system.update([entity], 1 / 60);
    expect(achievement.totalCoinsEarned).toBe(150);
    expect(achievement.lastKnownCoins).toBe(100);
  });

  it("should unlock big_spender from cumulative coin earnings", () => {
    const { entity, achievement, wallet } = createPlayer();
    // Simulate multiple income sources over several frames
    wallet.coins += 120;
    system.update([entity], 1 / 60);
    system.update([entity], 1 / 60); // pay reward for first_harvest etc
    wallet.coins += 100;
    for (let i = 0; i < 10; i++) system.update([entity], 1 / 60);
    expect(achievement.totalCoinsEarned).toBeGreaterThanOrEqual(200);
    expect(achievement.unlocked.has("big_spender")).toBe(true);
  });

  it("should increment totalFishCaught via recordFishCaught listener", () => {
    const { entity, achievement } = createPlayer();
    system.recordFishCaught();
    system.recordFishCaught();
    system.update([entity], 1 / 60);
    expect(achievement.totalFishCaught).toBe(2);
  });

  it("should unlock first_fish when recordFishCaught is called", () => {
    const { entity, achievement } = createPlayer();
    system.recordFishCaught();
    system.update([entity], 1 / 60);
    expect(achievement.unlocked.has("first_fish")).toBe(true);
  });

  it("should derive totalQuestsCompleted from quest entries", () => {
    const { entity, achievement, quest } = createPlayer();
    quest.entries["q1"] = { state: "completed", progress: 1, baseline: 0 };
    quest.entries["q2"] = { state: "active", progress: 0, baseline: 0 };
    system.update([entity], 1 / 60);
    expect(achievement.totalQuestsCompleted).toBe(1);
  });

  it("should clear pending fish after update", () => {
    const { entity, achievement } = createPlayer();
    system.recordFishCaught();
    system.update([entity], 1 / 60);
    // Second update with no new fish
    system.update([entity], 1 / 60);
    expect(achievement.totalFishCaught).toBe(1);
  });
});

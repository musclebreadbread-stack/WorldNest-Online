import { describe, it, expect, beforeEach } from "vitest";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { WalletComponent } from "../components/WalletComponent";
import { CollectionComponent } from "../components/CollectionComponent";
import { QuestComponent } from "../components/QuestComponent";
import { addItem, countItem } from "../inventory/inventoryOps";
import {
  COLLECTION_CATEGORIES,
  COLLECTION_CATEGORY_IDS,
  getCategory,
  isCollectable,
} from "../collection/collectionDefinitions";
import {
  canDonate,
  claimCategoryReward,
  donate,
  getCategoryProgress,
  isCategoryComplete,
  totalCollectable,
  totalDonated,
} from "../collection/collectionOps";
import { CollectionSystem } from "../systems/CollectionSystem";
import {
  activateQuest,
  getEntry,
  objectiveProgress,
  recordDonation,
  type QuestProgressSource,
} from "../quests/questOps";
import { QUEST_DEFINITIONS } from "../quests/questDefinitions";

function emptySource(): QuestProgressSource {
  return { itemCount: () => 0, structureCount: () => 0 };
}

function createCollector() {
  const collection = new CollectionComponent();
  const inventory = new InventoryComponent();
  const wallet = new WalletComponent(0);
  const quest = new QuestComponent();
  const entity = new Entity("collector");
  entity
    .addComponent(collection)
    .addComponent(inventory)
    .addComponent(wallet)
    .addComponent(quest);

  return { entity, collection, inventory, wallet, quest };
}

describe("collectionDefinitions", () => {
  it("should define four categories with valid entries", () => {
    expect(COLLECTION_CATEGORY_IDS).toEqual([
      "gathering",
      "farming",
      "fishing",
      "crafted",
    ]);
    for (const category of COLLECTION_CATEGORIES) {
      expect(category.entries.length).toBeGreaterThan(0);
      expect(category.rewardCoins).toBeGreaterThan(0);
      expect(category.titleKey).toMatch(/^collection\.category\./);
    }
  });

  it("should report collectable items correctly", () => {
    expect(isCollectable("wood")).toBe(true);
    expect(isCollectable("wheat")).toBe(true);
    expect(isCollectable("fish_rare")).toBe(true);
    expect(isCollectable("fence")).toBe(true);
    // Seeds and tools are not collectable
    expect(isCollectable("wheat_seed")).toBe(false);
    expect(isCollectable("fishing_rod")).toBe(false);
  });

  it("should look up categories by id", () => {
    expect(getCategory("gathering")).toBeDefined();
    expect(getCategory("nonexistent")).toBeUndefined();
  });

  it("should count total collectable items", () => {
    const total = COLLECTION_CATEGORIES.reduce((sum, c) => sum + c.entries.length, 0);
    expect(totalCollectable()).toBe(total);
  });
});

describe("canDonate", () => {
  it("should return true only when the item is collectable and in inventory", () => {
    const { inventory } = createCollector();
    expect(canDonate(inventory, "wood")).toBe(false);

    addItem(inventory, "wood", 3);
    expect(canDonate(inventory, "wood")).toBe(true);
  });

  it("should refuse non-collectable items", () => {
    const { inventory } = createCollector();
    addItem(inventory, "wheat_seed", 5);
    expect(canDonate(inventory, "wheat_seed")).toBe(false);
  });
});

describe("donate", () => {
  it("should remove 1 item and mark it discovered", () => {
    const { collection, inventory } = createCollector();
    addItem(inventory, "wood", 3);

    expect(donate(collection, inventory, "wood")).toBe(true);
    expect(collection.discovered.has("wood")).toBe(true);
    expect(countItem(inventory, "wood")).toBe(2);
    expect(collection.version).toBe(1);
  });

  it("should refuse duplicate donations", () => {
    const { collection, inventory } = createCollector();
    addItem(inventory, "wood", 3);

    donate(collection, inventory, "wood");
    expect(donate(collection, inventory, "wood")).toBe(false);
    expect(countItem(inventory, "wood")).toBe(2);
    expect(collection.version).toBe(1);
  });

  it("should refuse when item is not in inventory", () => {
    const { collection, inventory } = createCollector();
    expect(donate(collection, inventory, "wood")).toBe(false);
    expect(collection.discovered.size).toBe(0);
  });

  it("should refuse non-collectable items", () => {
    const { collection, inventory } = createCollector();
    addItem(inventory, "wheat_seed", 5);
    expect(donate(collection, inventory, "wheat_seed")).toBe(false);
  });
});

describe("getCategoryProgress", () => {
  it("should track correct progress", () => {
    const { collection, inventory } = createCollector();
    addItem(inventory, "wood", 1);
    addItem(inventory, "stone", 1);

    donate(collection, inventory, "wood");
    donate(collection, inventory, "stone");

    const progress = getCategoryProgress(collection, "gathering");
    expect(progress).toEqual({ discovered: 2, total: 5 });
  });

  it("should return zeros for unknown category", () => {
    const { collection } = createCollector();
    expect(getCategoryProgress(collection, "unknown")).toEqual({
      discovered: 0,
      total: 0,
    });
  });
});

describe("isCategoryComplete", () => {
  it("should detect a complete category", () => {
    const { collection, inventory } = createCollector();
    const fishing = getCategory("fishing")!;

    for (const itemId of fishing.entries) {
      addItem(inventory, itemId, 1);
      donate(collection, inventory, itemId);
    }

    expect(isCategoryComplete(collection, "fishing")).toBe(true);
    expect(isCategoryComplete(collection, "gathering")).toBe(false);
  });

  it("should return false for unknown category", () => {
    const { collection } = createCollector();
    expect(isCategoryComplete(collection, "unknown")).toBe(false);
  });
});

describe("claimCategoryReward", () => {
  it("should add coins when category is complete", () => {
    const { collection, inventory, wallet } = createCollector();
    const fishing = getCategory("fishing")!;

    for (const itemId of fishing.entries) {
      addItem(inventory, itemId, 1);
      donate(collection, inventory, itemId);
    }

    const versionBefore = collection.version;
    expect(claimCategoryReward(collection, wallet, "fishing")).toBe(true);
    expect(wallet.coins).toBe(fishing.rewardCoins);
    expect(collection.categoryRewardsClaimed.has("fishing")).toBe(true);
    expect(collection.version).toBe(versionBefore + 1);
  });

  it("should refuse a second claim", () => {
    const { collection, inventory, wallet } = createCollector();
    const fishing = getCategory("fishing")!;

    for (const itemId of fishing.entries) {
      addItem(inventory, itemId, 1);
      donate(collection, inventory, itemId);
    }

    claimCategoryReward(collection, wallet, "fishing");
    expect(claimCategoryReward(collection, wallet, "fishing")).toBe(false);
    expect(wallet.coins).toBe(fishing.rewardCoins);
  });

  it("should refuse when category is incomplete", () => {
    const { collection, inventory, wallet } = createCollector();
    addItem(inventory, "wood", 1);
    donate(collection, inventory, "wood");

    expect(claimCategoryReward(collection, wallet, "gathering")).toBe(false);
    expect(wallet.coins).toBe(0);
  });
});

describe("totalDonated", () => {
  it("should count unique donations", () => {
    const { collection, inventory } = createCollector();
    addItem(inventory, "wood", 1);
    addItem(inventory, "stone", 1);

    donate(collection, inventory, "wood");
    donate(collection, inventory, "stone");

    expect(totalDonated(collection)).toBe(2);
  });
});

describe("CollectionSystem", () => {
  let system: CollectionSystem;

  beforeEach(() => {
    system = new CollectionSystem();
  });

  it("should require collection, inventory and wallet components", () => {
    expect(system.requiredComponents).toEqual(["collection", "inventory", "wallet"]);
  });

  it("should process a donation request", () => {
    const { entity, collection, inventory } = createCollector();
    addItem(inventory, "wood", 3);

    collection.requestedDonation = "wood";
    system.update([entity], 1 / 60);

    expect(collection.discovered.has("wood")).toBe(true);
    expect(collection.requestedDonation).toBeNull();
    expect(countItem(inventory, "wood")).toBe(2);
  });

  it("should auto-claim reward when category completes", () => {
    const { entity, collection, inventory, wallet } = createCollector();
    const fishing = getCategory("fishing")!;

    // Donate all but the last fish manually
    for (let i = 0; i < fishing.entries.length - 1; i++) {
      addItem(inventory, fishing.entries[i], 1);
      donate(collection, inventory, fishing.entries[i]);
    }

    // Donate the last one through the system
    const lastEntry = fishing.entries[fishing.entries.length - 1];
    addItem(inventory, lastEntry, 1);
    collection.requestedDonation = lastEntry;
    system.update([entity], 1 / 60);

    expect(isCategoryComplete(collection, "fishing")).toBe(true);
    expect(collection.categoryRewardsClaimed.has("fishing")).toBe(true);
    expect(wallet.coins).toBe(fishing.rewardCoins);
  });

  it("should ignore a donation for an item not in inventory", () => {
    const { entity, collection } = createCollector();

    collection.requestedDonation = "wood";
    system.update([entity], 1 / 60);

    expect(collection.discovered.has("wood")).toBe(false);
    expect(collection.requestedDonation).toBeNull();
  });
});

describe("quest objective 'donate'", () => {
  it("should define donate_first with kind donate", () => {
    const quest = QUEST_DEFINITIONS.donate_first;
    expect(quest).toBeDefined();
    expect(quest.objective.kind).toBe("donate");
    if (quest.objective.kind === "donate") {
      expect(quest.objective.count).toBe(1);
    }
  });

  it("should track progress via recordDonation", () => {
    const { quest } = createCollector();
    activateQuest(quest, "donate_first");

    expect(recordDonation(quest, 1)).toBe(true);
    expect(getEntry(quest, "donate_first")!.progress).toBe(1);
  });

  it("should report progress from entry for donate objective", () => {
    const entry = { state: "active" as const, progress: 1, baseline: 0 };
    const objective = QUEST_DEFINITIONS.donate_first.objective;
    expect(objectiveProgress(objective, entry, emptySource())).toBe(1);
  });

  it("should not increment beyond the target", () => {
    const { quest } = createCollector();
    activateQuest(quest, "donate_first");

    recordDonation(quest, 5);
    expect(getEntry(quest, "donate_first")!.progress).toBe(1);
  });

  it("should not change progress when nothing moved", () => {
    const { quest } = createCollector();
    activateQuest(quest, "donate_first");

    expect(recordDonation(quest, 0)).toBe(false);
  });
});

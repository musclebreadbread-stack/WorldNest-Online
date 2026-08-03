import { describe, it, expect } from "vitest";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { PositionComponent } from "../components/PositionComponent";
import { InteractionComponent } from "../components/InteractionComponent";
import { WalletComponent } from "../components/WalletComponent";
import { FriendshipComponent } from "../components/FriendshipComponent";
import { FriendshipSystem } from "../systems/FriendshipSystem";
import { addItem } from "../inventory/inventoryOps";
import { ITEM_IDS, type ItemId } from "@worldnest/shared";
import {
  FRIENDSHIP_THRESHOLDS,
  GIFT_BASE_POINTS,
  GIFT_MULTIPLIERS,
  LEVEL_REWARDS,
  MAX_DAILY_GIFTS,
  NPC_GIFT_PREFERENCES,
  canGiveGift,
  getGiftReaction,
  getFriendshipLevel,
  getHighestFriendshipLevel,
  getLevelReward,
  getTotalGiftsGiven,
  giveGift,
  resetDailyGifts,
} from "../friendship";

function createHarness(day = 1) {
  let currentDay = day;
  const inventory = new InventoryComponent();
  const position = new PositionComponent();
  const interaction = new InteractionComponent();
  const wallet = new WalletComponent();
  const friendship = new FriendshipComponent();
  const entity = new Entity("player")
    .addComponent(inventory)
    .addComponent(position)
    .addComponent(interaction)
    .addComponent(wallet)
    .addComponent(friendship);
  const system = new FriendshipSystem(() => currentDay, undefined, undefined);
  const setDay = (d: number) => {
    currentDay = d;
  };
  return { entity, inventory, wallet, friendship, system, setDay };
}

describe("friendshipDefinitions", () => {
  it("thresholds are ascending", () => {
    for (let i = 1; i < FRIENDSHIP_THRESHOLDS.length; i++) {
      expect(FRIENDSHIP_THRESHOLDS[i]).toBeGreaterThan(FRIENDSHIP_THRESHOLDS[i - 1]);
    }
  });

  it("NPC_GIFT_PREFERENCES reference valid ItemIds", () => {
    const validIds = new Set<string>(ITEM_IDS);
    for (const [npcId, pref] of Object.entries(NPC_GIFT_PREFERENCES)) {
      for (const item of pref.lovedItems) {
        expect(validIds.has(item), `${npcId} loved: ${item}`).toBe(true);
      }
      for (const item of pref.likedItems) {
        expect(validIds.has(item), `${npcId} liked: ${item}`).toBe(true);
      }
      for (const item of pref.dislikedItems) {
        expect(validIds.has(item), `${npcId} disliked: ${item}`).toBe(true);
      }
    }
  });

  it("has preferences for all 8 NPCs", () => {
    expect(Object.keys(NPC_GIFT_PREFERENCES).length).toBe(8);
  });
});

describe("canGiveGift", () => {
  it("returns false when item not in inventory", () => {
    const inv = new InventoryComponent();
    expect(canGiveGift(inv, "flower" as ItemId, undefined, 1)).toBe(false);
  });

  it("returns true when item in inventory and no prior entry", () => {
    const inv = new InventoryComponent();
    addItem(inv, "flower", 1);
    expect(canGiveGift(inv, "flower" as ItemId, undefined, 1)).toBe(true);
  });

  it("returns false after daily limit reached", () => {
    const inv = new InventoryComponent();
    addItem(inv, "flower", 5);
    const entry = {
      npcId: "villager_pip",
      points: 10,
      level: 0,
      lastGiftDay: 1,
      giftsGivenToday: MAX_DAILY_GIFTS,
      totalGiftsGiven: 1,
    };
    expect(canGiveGift(inv, "flower" as ItemId, entry, 1)).toBe(false);
  });

  it("allows gift on new day even if yesterday was maxed", () => {
    const inv = new InventoryComponent();
    addItem(inv, "flower", 5);
    const entry = {
      npcId: "villager_pip",
      points: 10,
      level: 0,
      lastGiftDay: 1,
      giftsGivenToday: MAX_DAILY_GIFTS,
      totalGiftsGiven: 1,
    };
    expect(canGiveGift(inv, "flower" as ItemId, entry, 2)).toBe(true);
  });
});

describe("getGiftReaction", () => {
  it("returns loved for a loved item", () => {
    expect(getGiftReaction("villager_pip", "flower" as ItemId)).toBe("loved");
  });

  it("returns liked for a liked item", () => {
    expect(getGiftReaction("villager_pip", "wheat" as ItemId)).toBe("liked");
  });

  it("returns disliked for a disliked item", () => {
    expect(getGiftReaction("villager_pip", "stone" as ItemId)).toBe("disliked");
  });

  it("returns neutral for unknown items", () => {
    expect(getGiftReaction("villager_pip", "fish_common" as ItemId)).toBe("neutral");
  });

  it("returns neutral for unknown NPC", () => {
    expect(getGiftReaction("unknown_npc", "flower" as ItemId)).toBe("neutral");
  });
});

describe("giveGift", () => {
  it("calculates loved multiplier correctly", () => {
    const result = giveGift("villager_pip", "flower" as ItemId, undefined, 1);
    expect(result.pointsEarned).toBe(
      Math.floor(GIFT_BASE_POINTS * GIFT_MULTIPLIERS.loved),
    );
    expect(result.reaction).toBe("loved");
  });

  it("calculates liked multiplier correctly", () => {
    const result = giveGift("villager_pip", "wheat" as ItemId, undefined, 1);
    expect(result.pointsEarned).toBe(
      Math.floor(GIFT_BASE_POINTS * GIFT_MULTIPLIERS.liked),
    );
  });

  it("calculates disliked multiplier correctly", () => {
    const result = giveGift("villager_pip", "stone" as ItemId, undefined, 1);
    expect(result.pointsEarned).toBe(
      Math.floor(GIFT_BASE_POINTS * GIFT_MULTIPLIERS.disliked),
    );
  });

  it("advances level when threshold is crossed", () => {
    const entry = {
      npcId: "villager_pip",
      points: 18,
      level: 0,
      lastGiftDay: 1,
      giftsGivenToday: 0,
      totalGiftsGiven: 2,
    };
    // Loved gives 15 pts, so 18+15=33 which passes threshold 20
    const result = giveGift("villager_pip", "flower" as ItemId, entry, 1);
    expect(result.entry.level).toBe(1);
    expect(result.leveledUp).toBe(true);
    expect(result.reward).toBe(LEVEL_REWARDS[1]);
  });

  it("does not level up when threshold is not reached", () => {
    const entry = {
      npcId: "villager_pip",
      points: 0,
      level: 0,
      lastGiftDay: 1,
      giftsGivenToday: 0,
      totalGiftsGiven: 0,
    };
    const result = giveGift("villager_pip", "stone" as ItemId, entry, 1);
    expect(result.entry.level).toBe(0);
    expect(result.leveledUp).toBe(false);
    expect(result.reward).toBe(0);
  });

  it("increments giftsGivenToday", () => {
    const result = giveGift("villager_pip", "flower" as ItemId, undefined, 5);
    expect(result.entry.giftsGivenToday).toBe(1);
    expect(result.entry.lastGiftDay).toBe(5);
  });

  it("resets giftsGivenToday on new day", () => {
    const entry = {
      npcId: "villager_pip",
      points: 10,
      level: 0,
      lastGiftDay: 1,
      giftsGivenToday: 1,
      totalGiftsGiven: 1,
    };
    const result = giveGift("villager_pip", "flower" as ItemId, entry, 2);
    expect(result.entry.giftsGivenToday).toBe(1);
    expect(result.entry.lastGiftDay).toBe(2);
  });
});

describe("getFriendshipLevel", () => {
  it("returns 0 for 0 points", () => {
    expect(getFriendshipLevel(0)).toBe(0);
  });
  it("returns 1 for 20 points", () => {
    expect(getFriendshipLevel(20)).toBe(1);
  });
  it("returns 2 for 50 points", () => {
    expect(getFriendshipLevel(50)).toBe(2);
  });
  it("returns 3 for 100 points", () => {
    expect(getFriendshipLevel(100)).toBe(3);
  });
  it("returns 4 for 200 points", () => {
    expect(getFriendshipLevel(200)).toBe(4);
  });
  it("returns 4 for points above 200", () => {
    expect(getFriendshipLevel(999)).toBe(4);
  });
  it("returns 0 for points between 1 and 19", () => {
    expect(getFriendshipLevel(19)).toBe(0);
  });
});

describe("getLevelReward", () => {
  it("returns 0 for level 0", () => {
    expect(getLevelReward(0)).toBe(0);
  });
  it("returns correct reward for each level", () => {
    expect(getLevelReward(1)).toBe(10);
    expect(getLevelReward(2)).toBe(20);
    expect(getLevelReward(3)).toBe(35);
    expect(getLevelReward(4)).toBe(75);
  });
});

describe("resetDailyGifts", () => {
  it("resets all entries to 0 giftsGivenToday", () => {
    const entries = {
      pip: {
        npcId: "villager_pip",
        points: 30,
        level: 1,
        lastGiftDay: 1,
        giftsGivenToday: 1,
        totalGiftsGiven: 4,
      },
      juno: {
        npcId: "shopkeeper_juno",
        points: 10,
        level: 0,
        lastGiftDay: 1,
        giftsGivenToday: 1,
        totalGiftsGiven: 2,
      },
    };
    const result = resetDailyGifts(entries, 2);
    expect(result.pip.giftsGivenToday).toBe(0);
    expect(result.pip.lastGiftDay).toBe(2);
    expect(result.juno.giftsGivenToday).toBe(0);
    expect(result.juno.lastGiftDay).toBe(2);
  });

  it("preserves points and level", () => {
    const entries = {
      pip: {
        npcId: "villager_pip",
        points: 55,
        level: 2,
        lastGiftDay: 5,
        giftsGivenToday: 1,
        totalGiftsGiven: 8,
      },
    };
    const result = resetDailyGifts(entries, 6);
    expect(result.pip.points).toBe(55);
    expect(result.pip.level).toBe(2);
  });
});

describe("getHighestFriendshipLevel", () => {
  it("returns 0 for empty entries", () => {
    expect(getHighestFriendshipLevel({})).toBe(0);
  });
  it("returns the highest level among entries", () => {
    const entries = {
      a: {
        npcId: "a",
        points: 25,
        level: 1,
        lastGiftDay: 1,
        giftsGivenToday: 0,
        totalGiftsGiven: 3,
      },
      b: {
        npcId: "b",
        points: 110,
        level: 3,
        lastGiftDay: 1,
        giftsGivenToday: 0,
        totalGiftsGiven: 10,
      },
    };
    expect(getHighestFriendshipLevel(entries)).toBe(3);
  });
});

describe("getTotalGiftsGiven", () => {
  it("returns 0 for empty entries", () => {
    expect(getTotalGiftsGiven({})).toBe(0);
  });
  it("sums totalGiftsGiven counters across entries", () => {
    const entries = {
      a: {
        npcId: "a",
        points: 15,
        level: 0,
        lastGiftDay: 1,
        giftsGivenToday: 0,
        totalGiftsGiven: 3,
      },
      b: {
        npcId: "b",
        points: 30,
        level: 1,
        lastGiftDay: 1,
        giftsGivenToday: 0,
        totalGiftsGiven: 5,
      },
    };
    expect(getTotalGiftsGiven(entries)).toBe(8);
  });
});

describe("FriendshipSystem", () => {
  it("processes a gift request and consumes item", () => {
    const { inventory, friendship, system, entity } = createHarness(1);
    addItem(inventory, "flower", 3);
    friendship.requestGift = { npcId: "villager_pip", itemId: "flower" as ItemId };
    system.update([entity], 0);
    expect(friendship.entries["villager_pip"]).toBeDefined();
    expect(friendship.entries["villager_pip"].points).toBeGreaterThan(0);
    // Item consumed
    const remaining = inventory.slots.find((s) => s?.itemId === "flower");
    expect(remaining?.quantity).toBe(2);
  });

  it("rejects gift if item not in inventory", () => {
    const { friendship, system, entity } = createHarness(1);
    friendship.requestGift = { npcId: "villager_pip", itemId: "flower" as ItemId };
    system.update([entity], 0);
    expect(friendship.entries["villager_pip"]).toBeUndefined();
  });

  it("enforces daily limit per NPC", () => {
    const { inventory, friendship, system, entity } = createHarness(1);
    addItem(inventory, "flower", 5);
    // First gift
    friendship.requestGift = { npcId: "villager_pip", itemId: "flower" as ItemId };
    system.update([entity], 0);
    const pointsAfterFirst = friendship.entries["villager_pip"].points;
    // Second gift same day (should be rejected)
    friendship.requestGift = { npcId: "villager_pip", itemId: "flower" as ItemId };
    system.update([entity], 0);
    expect(friendship.entries["villager_pip"].points).toBe(pointsAfterFirst);
  });

  it("resets daily gifts on day change", () => {
    const { inventory, friendship, system, entity, setDay } = createHarness(1);
    addItem(inventory, "flower", 10);
    // Give on day 1
    friendship.requestGift = { npcId: "villager_pip", itemId: "flower" as ItemId };
    system.update([entity], 0);
    // Move to day 2
    setDay(2);
    system.update([entity], 0);
    expect(friendship.entries["villager_pip"].giftsGivenToday).toBe(0);
  });

  it("pays level-up reward to wallet", () => {
    const { inventory, wallet, friendship, system, entity } = createHarness(1);
    addItem(inventory, "flower", 20);
    // Set points just below threshold
    friendship.entries["villager_pip"] = {
      npcId: "villager_pip",
      points: 18,
      level: 0,
      lastGiftDay: 0,
      giftsGivenToday: 0,
      totalGiftsGiven: 2,
    };
    friendship.requestGift = { npcId: "villager_pip", itemId: "flower" as ItemId };
    const coinsBefore = wallet.coins;
    system.update([entity], 0);
    expect(wallet.coins).toBe(coinsBefore + LEVEL_REWARDS[1]);
  });

  it("calls onGiftGiven listener", () => {
    let called = false;
    const inventory = new InventoryComponent();
    const position = new PositionComponent();
    const interaction = new InteractionComponent();
    const wallet = new WalletComponent();
    const friendship = new FriendshipComponent();
    const entity = new Entity("player")
      .addComponent(inventory)
      .addComponent(position)
      .addComponent(interaction)
      .addComponent(wallet)
      .addComponent(friendship);
    const system = new FriendshipSystem(
      () => 1,
      () => {
        called = true;
      },
    );
    addItem(inventory, "flower", 1);
    friendship.requestGift = { npcId: "villager_pip", itemId: "flower" as ItemId };
    system.update([entity], 0);
    expect(called).toBe(true);
  });
});

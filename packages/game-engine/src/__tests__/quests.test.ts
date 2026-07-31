import { describe, it, expect, beforeEach } from "vitest";
import { ITEM_DEFINITIONS, isItemId } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { InventoryComponent } from "../components/InventoryComponent";
import { QuestComponent } from "../components/QuestComponent";
import { WalletComponent } from "../components/WalletComponent";
import { dialogueQuestIds } from "../dialogue/dialogueOps";
import { addItem, countItem } from "../inventory/inventoryOps";
import { NPC_DEFINITIONS } from "../world/NpcCatalogue";
import {
  QUEST_DEFINITIONS,
  QUEST_IDS,
  getQuest,
  objectiveTarget,
} from "../quests/questDefinitions";
import {
  activateQuest,
  completeQuest,
  getEntry,
  isObjectiveMet,
  objectiveProgress,
  offerQuest,
  pollProgress,
  recordTalk,
  type QuestProgressSource,
} from "../quests/questOps";
import { QuestSystem } from "../systems/QuestSystem";

const WOOD_QUEST = QUEST_DEFINITIONS.collect_wood;
const FENCE_QUEST = QUEST_DEFINITIONS.build_fence;
const TALK_QUEST = QUEST_DEFINITIONS.greet_pip;

/** A progress source that counts nothing, so a test can opt in per objective. */
function emptySource(
  overrides: Partial<QuestProgressSource> = {},
): QuestProgressSource {
  return { itemCount: () => 0, structureCount: () => 0, ...overrides };
}

function createAdventurer() {
  const quest = new QuestComponent();
  const inventory = new InventoryComponent();
  const wallet = new WalletComponent(0);
  const entity = new Entity("adventurer");
  entity.addComponent(quest).addComponent(inventory).addComponent(wallet);

  return { entity, quest, inventory, wallet };
}

describe("QUEST_DEFINITIONS", () => {
  it("should use exactly the quest ids the dialogue trees refer to", () => {
    // A typo in either would otherwise show up only as an option that quietly
    // does nothing when a player picks it
    expect(dialogueQuestIds().sort()).toEqual([...QUEST_IDS].sort());
  });

  it("should be given out by NPCs that actually exist", () => {
    const npcIds = NPC_DEFINITIONS.map((definition) => definition.id);

    for (const questId of QUEST_IDS) {
      expect(npcIds, questId).toContain(QUEST_DEFINITIONS[questId].giverNpcId);
    }
  });

  it("should reward catalogue items in positive whole amounts", () => {
    for (const questId of QUEST_IDS) {
      const { rewards } = QUEST_DEFINITIONS[questId];

      expect(Number.isInteger(rewards.coins), questId).toBe(true);
      expect(rewards.coins, questId).toBeGreaterThan(0);

      for (const reward of rewards.items) {
        expect(isItemId(reward.itemId), questId).toBe(true);
        expect(reward.quantity, questId).toBeGreaterThan(0);
        expect(reward.quantity, questId).toBeLessThanOrEqual(
          ITEM_DEFINITIONS[reward.itemId].stackSize,
        );
      }
    }
  });

  it("should hold keys rather than sentences, and cover all three kinds", () => {
    for (const questId of QUEST_IDS) {
      const definition = QUEST_DEFINITIONS[questId];

      expect(definition.id).toBe(questId);
      expect(definition.titleKey, questId).toMatch(/^quest\./);
      expect(definition.descriptionKey, questId).toMatch(/^quest\./);
      expect(definition.titleKey, questId).not.toContain(" ");
    }

    const kinds = QUEST_IDS.map((id) => QUEST_DEFINITIONS[id].objective.kind);
    expect(new Set(kinds)).toEqual(new Set(["collect", "build", "talk"]));
  });

  it("should aim every talk objective at an NPC that exists", () => {
    const npcIds = NPC_DEFINITIONS.map((definition) => definition.id);

    for (const questId of QUEST_IDS) {
      const objective = QUEST_DEFINITIONS[questId].objective;
      if (objective.kind !== "talk") continue;

      expect(npcIds).toContain(objective.npcId);
    }
  });

  it("should report an unknown id as unknown", () => {
    expect(getQuest("rescue_the_moon")).toBeUndefined();
    expect(objectiveTarget(TALK_QUEST.objective)).toBe(1);
    expect(objectiveTarget(WOOD_QUEST.objective)).toBe(5);
  });
});

describe("offerQuest and activateQuest", () => {
  it("should record an offer once and never reset progress", () => {
    const { quest } = createAdventurer();

    expect(offerQuest(quest, "collect_wood")).toBe(true);
    expect(getEntry(quest, "collect_wood")).toEqual({
      state: "available",
      progress: 0,
    });
    expect(quest.version).toBe(1);

    expect(offerQuest(quest, "collect_wood")).toBe(false);
    expect(quest.version).toBe(1);
  });

  it("should refuse an unknown quest id outright", () => {
    const { quest } = createAdventurer();

    expect(offerQuest(quest, "rescue_the_moon")).toBe(false);
    expect(activateQuest(quest, "rescue_the_moon")).toBe(false);
    expect(quest.entries).toEqual({});
  });

  it("should accept a quest that was offered, or one seen for the first time", () => {
    const { quest } = createAdventurer();

    offerQuest(quest, "collect_wood");
    expect(activateQuest(quest, "collect_wood")).toBe(true);
    expect(getEntry(quest, "collect_wood")!.state).toBe("active");

    // Ada offers and accepts in one option, so activating from nothing works too
    expect(activateQuest(quest, "greet_pip")).toBe(true);
    expect(getEntry(quest, "greet_pip")!.state).toBe("active");
  });

  it("should refuse to re-accept an active or finished quest", () => {
    const { quest } = createAdventurer();

    activateQuest(quest, "collect_wood");
    expect(activateQuest(quest, "collect_wood")).toBe(false);

    quest.entries.collect_wood.state = "completed";
    expect(activateQuest(quest, "collect_wood")).toBe(false);
  });
});

describe("objectiveProgress", () => {
  it("should count the inventory for a collect objective, clamped to the target", () => {
    const entry = { state: "active" as const, progress: 0 };

    expect(
      objectiveProgress(
        WOOD_QUEST.objective,
        entry,
        emptySource({ itemCount: () => 2 }),
      ),
    ).toBe(2);
    expect(
      objectiveProgress(
        WOOD_QUEST.objective,
        entry,
        emptySource({ itemCount: () => 99 }),
      ),
    ).toBe(objectiveTarget(WOOD_QUEST.objective));
  });

  it("should count placed structures for a build objective", () => {
    const entry = { state: "active" as const, progress: 0 };

    expect(
      objectiveProgress(
        FENCE_QUEST.objective,
        entry,
        emptySource({ structureCount: () => 1 }),
      ),
    ).toBe(1);
  });

  // A visit is a moment, not a state, so it is recorded rather than polled
  it("should read a talk objective back off the entry", () => {
    expect(
      objectiveProgress(
        TALK_QUEST.objective,
        { state: "active", progress: 1 },
        emptySource(),
      ),
    ).toBe(1);
    expect(
      objectiveProgress(
        TALK_QUEST.objective,
        { state: "active", progress: 0 },
        emptySource(),
      ),
    ).toBe(0);
  });

  it("should judge completion against the target", () => {
    expect(isObjectiveMet(WOOD_QUEST, 4)).toBe(false);
    expect(isObjectiveMet(WOOD_QUEST, 5)).toBe(true);
    expect(isObjectiveMet(TALK_QUEST, 1)).toBe(true);
  });
});

describe("pollProgress", () => {
  it("should only touch active quests and only publish real movement", () => {
    const { quest } = createAdventurer();
    activateQuest(quest, "collect_wood");
    offerQuest(quest, "build_fence");
    const version = quest.version;

    expect(pollProgress(quest, emptySource({ itemCount: () => 3 }))).toBe(true);
    expect(getEntry(quest, "collect_wood")!.progress).toBe(3);
    expect(getEntry(quest, "build_fence")!.progress).toBe(0);
    expect(quest.version).toBe(version + 1);

    // Nothing moved, so nothing is published
    expect(pollProgress(quest, emptySource({ itemCount: () => 3 }))).toBe(false);
    expect(quest.version).toBe(version + 1);
  });
});

describe("recordTalk", () => {
  it("should finish an active talk objective aimed at that NPC", () => {
    const { quest } = createAdventurer();
    activateQuest(quest, "greet_pip");

    expect(recordTalk(quest, "shopkeeper_juno")).toBe(false);
    expect(recordTalk(quest, "villager_pip")).toBe(true);
    expect(getEntry(quest, "greet_pip")!.progress).toBe(1);

    // Saying hello twice is not twice the progress
    expect(recordTalk(quest, "villager_pip")).toBe(false);
  });

  it("should ignore a talk for a quest that was never taken on", () => {
    const { quest } = createAdventurer();
    offerQuest(quest, "greet_pip");

    expect(recordTalk(quest, "villager_pip")).toBe(false);
    expect(getEntry(quest, "greet_pip")!.progress).toBe(0);
  });
});

describe("completeQuest", () => {
  it("should pay out exactly once", () => {
    const { quest, inventory, wallet } = createAdventurer();
    activateQuest(quest, "collect_wood");
    addItem(inventory, "wood", 5);
    const source = emptySource({ itemCount: (itemId) => countItem(inventory, itemId) });

    expect(completeQuest(quest, "collect_wood", inventory, wallet, source)).toBe(true);
    expect(wallet.coins).toBe(WOOD_QUEST.rewards.coins);
    expect(countItem(inventory, "wheat_seed")).toBe(3);
    expect(getEntry(quest, "collect_wood")!.state).toBe("completed");

    // A second hand-in changes nothing at all
    expect(completeQuest(quest, "collect_wood", inventory, wallet, source)).toBe(false);
    expect(wallet.coins).toBe(WOOD_QUEST.rewards.coins);
    expect(countItem(inventory, "wheat_seed")).toBe(3);
  });

  it("should refuse a quest whose objective is not met", () => {
    const { quest, inventory, wallet } = createAdventurer();
    activateQuest(quest, "collect_wood");
    addItem(inventory, "wood", 4);
    const source = emptySource({ itemCount: (itemId) => countItem(inventory, itemId) });

    expect(completeQuest(quest, "collect_wood", inventory, wallet, source)).toBe(false);
    expect(wallet.coins).toBe(0);
    expect(getEntry(quest, "collect_wood")!.state).toBe("active");
  });

  it("should refuse a quest that was never taken on", () => {
    const { quest, inventory, wallet } = createAdventurer();
    const source = emptySource({ itemCount: () => 99 });

    expect(completeQuest(quest, "collect_wood", inventory, wallet, source)).toBe(false);

    offerQuest(quest, "collect_wood");
    expect(completeQuest(quest, "collect_wood", inventory, wallet, source)).toBe(false);
  });

  // Nothing may be silently destroyed: the same rule HarvestSystem follows
  it("should refuse the turn-in when the reward would not fit, keeping the quest", () => {
    const { quest, inventory, wallet } = createAdventurer();
    activateQuest(quest, "greet_pip");
    recordTalk(quest, "villager_pip");
    for (let index = 0; index < inventory.slots.length; index++) {
      inventory.slots[index] = { itemId: "stone", quantity: 99 };
    }

    expect(completeQuest(quest, "greet_pip", inventory, wallet, emptySource())).toBe(
      false,
    );
    expect(wallet.coins).toBe(0);
    expect(getEntry(quest, "greet_pip")!.state).toBe("active");
  });
});

describe("QuestSystem", () => {
  let fences: number;
  let system: QuestSystem;

  beforeEach(() => {
    fences = 0;
    system = new QuestSystem((itemId) => (itemId === "fence" ? fences : 0));
  });

  it("should require the quest, inventory and wallet components", () => {
    expect(system.requiredComponents).toEqual(["quest", "inventory", "wallet"]);
  });

  it("should take on the quest the HUD asked for", () => {
    const { entity, quest } = createAdventurer();

    quest.requestedOffer = "collect_wood";
    system.update([entity], 1 / 60);

    expect(getEntry(quest, "collect_wood")!.state).toBe("active");
    expect(quest.requestedOffer).toBeNull();
    expect(quest.refusals).toBe(0);
  });

  it("should count a second request for the same quest as a refusal", () => {
    const { entity, quest } = createAdventurer();

    quest.requestedOffer = "collect_wood";
    system.update([entity], 1 / 60);
    quest.requestedOffer = "collect_wood";
    system.update([entity], 1 / 60);

    expect(quest.refusals).toBe(1);
  });

  it("should poll a collect objective off the inventory", () => {
    const { entity, quest, inventory } = createAdventurer();

    quest.requestedOffer = "collect_wood";
    system.update([entity], 1 / 60);
    addItem(inventory, "wood", 2);
    system.update([entity], 1 / 60);

    expect(getEntry(quest, "collect_wood")!.progress).toBe(2);
  });

  it("should poll a build objective off the injected structure count", () => {
    const { entity, quest } = createAdventurer();

    quest.requestedOffer = "build_fence";
    system.update([entity], 1 / 60);
    fences = 2;
    system.update([entity], 1 / 60);

    expect(getEntry(quest, "build_fence")!.progress).toBe(2);
  });

  it("should apply a greeting reported by NpcSystem", () => {
    const { entity, quest } = createAdventurer();

    quest.requestedOffer = "greet_pip";
    system.update([entity], 1 / 60);

    system.recordTalk("villager_pip");
    system.update([entity], 1 / 60);

    expect(getEntry(quest, "greet_pip")!.progress).toBe(1);

    // The report is consumed, not queued forever
    system.update([entity], 1 / 60);
    expect(getEntry(quest, "greet_pip")!.progress).toBe(1);
  });

  it("should hand in on the very frame the last item arrived", () => {
    const { entity, quest, inventory, wallet } = createAdventurer();

    quest.requestedOffer = "collect_wood";
    system.update([entity], 1 / 60);

    addItem(inventory, "wood", 5);
    quest.requestedTurnIn = "collect_wood";
    system.update([entity], 1 / 60);

    expect(getEntry(quest, "collect_wood")!.state).toBe("completed");
    expect(wallet.coins).toBe(WOOD_QUEST.rewards.coins);
    expect(quest.requestedTurnIn).toBeNull();
    expect(quest.refusals).toBe(0);
  });

  it("should count a hand-in it cannot honour as a refusal", () => {
    const { entity, quest, wallet } = createAdventurer();

    quest.requestedOffer = "collect_wood";
    quest.requestedTurnIn = "collect_wood";
    system.update([entity], 1 / 60);

    expect(quest.refusals).toBe(1);
    expect(wallet.coins).toBe(0);
    expect(getEntry(quest, "collect_wood")!.state).toBe("active");
  });
});

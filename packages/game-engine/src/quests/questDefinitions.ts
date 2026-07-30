import type { ItemId } from "@worldnest/shared";

/**
 * The quest catalogue.
 *
 * Every player-visible string is an **i18n key**, never a sentence (decision D8):
 * the quest log resolves `titleKey` and `descriptionKey` through the message
 * catalogue, which is what lets twelve languages share one catalogue. The web
 * suite asserts every key here resolves in all twelve locales.
 *
 * Objectives are limited to three kinds because all three can be judged by
 * polling state the engine already owns — the inventory, the structure index and
 * a talk the NPC system reports — so no event bus is needed. Rewards are fixed
 * amounts: nothing here is random, which the 10-18 audience rules require.
 */
export type QuestObjective =
  | { kind: "collect"; itemId: ItemId; count: number }
  | { kind: "build"; itemId: ItemId; count: number }
  | { kind: "talk"; npcId: string };

/** One reward stack. */
export interface QuestRewardItem {
  itemId: ItemId;
  quantity: number;
}

export interface QuestReward {
  items: QuestRewardItem[];
  coins: number;
}

export interface QuestDefinition {
  id: string;
  titleKey: string;
  descriptionKey: string;
  /** NPC who both hands the quest out and takes it in. */
  giverNpcId: string;
  objective: QuestObjective;
  rewards: QuestReward;
}

/**
 * The three starter quests, one per objective kind, all given by Ada.
 *
 * The ids are the ones her dialogue tree already refers to
 * (`dialogueQuestIds()`), and `quests.test.ts` asserts the two agree — a typo in
 * either would otherwise only show up as an option that silently does nothing.
 */
export const QUEST_DEFINITIONS: Record<string, QuestDefinition> = {
  // Collect: the gathering loop, payable in seeds so it leads into farming
  collect_wood: {
    id: "collect_wood",
    titleKey: "quest.collect_wood.title",
    descriptionKey: "quest.collect_wood.description",
    giverNpcId: "questgiver_ada",
    objective: { kind: "collect", itemId: "wood", count: 5 },
    rewards: { items: [{ itemId: "wheat_seed", quantity: 3 }], coins: 30 },
  },

  // Build: needs two fences, which are bought from Juno — so it also teaches
  // the shop. The reward more than covers what they cost.
  build_fence: {
    id: "build_fence",
    titleKey: "quest.build_fence.title",
    descriptionKey: "quest.build_fence.description",
    giverNpcId: "questgiver_ada",
    objective: { kind: "build", itemId: "fence", count: 2 },
    rewards: { items: [{ itemId: "wood", quantity: 3 }], coins: 50 },
  },

  // Talk: the gentlest possible first quest, and the one that introduces Pip
  greet_pip: {
    id: "greet_pip",
    titleKey: "quest.greet_pip.title",
    descriptionKey: "quest.greet_pip.description",
    giverNpcId: "questgiver_ada",
    objective: { kind: "talk", npcId: "villager_pip" },
    rewards: { items: [{ itemId: "flower", quantity: 2 }], coins: 15 },
  },
};

/** Every quest id, in catalogue order, so the quest log is stable. */
export const QUEST_IDS = Object.keys(QUEST_DEFINITIONS);

/** Definition for a quest id, or `undefined` when nothing is registered. */
export function getQuest(questId: string): QuestDefinition | undefined {
  return QUEST_DEFINITIONS[questId];
}

/**
 * Progress an objective is finished at. A `talk` objective is one visit, which
 * is why it has no count of its own.
 */
export function objectiveTarget(objective: QuestObjective): number {
  return objective.kind === "talk" ? 1 : objective.count;
}

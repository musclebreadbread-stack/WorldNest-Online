import type { Entity, QuestComponent } from "@worldnest/game-engine";
import { useQuestStore } from "../stores/questStore";

/**
 * Give `questStore` the two callbacks that reach the engine.
 *
 * The React → ECS seam for quests (decision D13): the log and the dialogue
 * options ask, `QuestSystem` decides. Nothing here reads an objective or pays a
 * reward, which is why a hand-in the engine refuses — an unmet objective, a full
 * backpack — cannot leave the log showing a quest as done.
 *
 * Returns a teardown function for whoever wired it.
 */
export function wireQuests(playerEntity: Entity): () => void {
  const quest = playerEntity.getComponent<QuestComponent>("quest");
  if (!quest) return () => undefined;

  useQuestStore.getState().setCallbacks(
    (questId) => {
      quest.requestedOffer = questId;
    },
    (questId) => {
      quest.requestedTurnIn = questId;
    },
  );

  return () => useQuestStore.getState().setCallbacks(null, null);
}

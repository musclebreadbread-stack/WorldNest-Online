import type { DialogueAction, DialogueComponent, Entity } from "@worldnest/game-engine";
import { useDialogueStore } from "../stores/dialogueStore";
import { useQuestStore } from "../stores/questStore";
import { useShopStore } from "../stores/shopStore";

/**
 * Give `dialogueStore` the two callbacks that reach the engine.
 *
 * This is the whole of the React → ECS seam for conversations (decision D13):
 * the panel and the number keys call `respond`/`close`, which only ever raise a
 * request flag on the player's `DialogueComponent`. `NpcSystem` consumes it on
 * the next frame, so the engine stays the single writer of dialogue state and a
 * stale click cannot move the graph behind its back.
 *
 * It is also where an option's **action** is routed. `advanceDialogue` returns
 * the action but the engine deliberately acts on `close` only, and the option the
 * player picked is already in the store snapshot — so opening a shop or taking on
 * a quest is decided here, on the one callback seam, and needs no new event.
 *
 * Returns a teardown function for whoever wired it.
 */
export function wireDialogue(playerEntity: Entity): () => void {
  const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue");
  if (!dialogue) return () => undefined;

  useDialogueStore.getState().setCallbacks(
    (optionIndex) => {
      const state = useDialogueStore.getState();
      const action = state.options[optionIndex]?.action;

      if (routeAction(action, state.npcId)) {
        // The action replaces the conversation rather than continuing it
        dialogue.closeRequested = true;
        return;
      }

      dialogue.requestedOption = optionIndex;
    },
    () => {
      dialogue.closeRequested = true;
    },
  );

  return () => useDialogueStore.getState().setCallbacks(null, null);
}

/**
 * Act on a dialogue action outside the graph, and report whether the
 * conversation should end because of it.
 *
 * `close` is handled by the engine itself and `undefined` just means "walk to the
 * next node", so both fall through to the normal path.
 */
function routeAction(
  action: DialogueAction | undefined,
  npcId: string | null,
): boolean {
  if (!action || npcId === null) return false;

  if (action.kind === "openShop") {
    useShopStore.getState().open(npcId);
    return true;
  }

  if (action.kind === "offerQuest") {
    useQuestStore.getState().accept(action.questId);
    return true;
  }

  if (action.kind === "turnInQuest") {
    useQuestStore.getState().turnIn(action.questId);
    return true;
  }

  return false;
}

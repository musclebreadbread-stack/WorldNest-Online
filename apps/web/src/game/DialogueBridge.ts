import type { DialogueComponent, Entity } from "@worldnest/game-engine";
import { useDialogueStore } from "../stores/dialogueStore";

/**
 * Give `dialogueStore` the two callbacks that reach the engine.
 *
 * This is the whole of the React → ECS seam for conversations (decision D13):
 * the panel and the number keys call `respond`/`close`, which only ever raise a
 * request flag on the player's `DialogueComponent`. `NpcSystem` consumes it on
 * the next frame, so the engine stays the single writer of dialogue state and a
 * stale click cannot move the graph behind its back.
 *
 * Items 21 and 23 hook the `openShop` and quest actions in here: the option's
 * action is already in the store snapshot, so they need no new event.
 *
 * Returns a teardown function for whoever wired it.
 */
export function wireDialogue(playerEntity: Entity): () => void {
  const dialogue = playerEntity.getComponent<DialogueComponent>("dialogue");
  if (!dialogue) return () => undefined;

  useDialogueStore.getState().setCallbacks(
    (optionIndex) => {
      dialogue.requestedOption = optionIndex;
    },
    () => {
      dialogue.closeRequested = true;
    },
  );

  return () => useDialogueStore.getState().setCallbacks(null, null);
}

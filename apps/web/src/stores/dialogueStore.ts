import { create } from "zustand";
import type { DialogueOption } from "@worldnest/game-engine";
import type { DialogueChangedEvent } from "../game/events";

/** Picks the option at an index. Injected by `DialogueBridge` once the game boots. */
export type DialogueResponder = (optionIndex: number) => void;

/** Ends the conversation. Injected alongside the responder. */
export type DialogueCloser = () => void;

interface DialogueState {
  /** NPC being talked to, or `null` when no conversation is open. */
  npcId: string | null;
  /** i18n key of the NPC's name, resolved by the panel. */
  nameKey: string | null;
  /** i18n key of the current line. */
  textKey: string | null;
  options: DialogueOption[];
  responder: DialogueResponder | null;
  closer: DialogueCloser | null;

  setSnapshot: (snapshot: DialogueChangedEvent) => void;
  setCallbacks: (
    responder: DialogueResponder | null,
    closer: DialogueCloser | null,
  ) => void;
  respond: (optionIndex: number) => void;
  close: () => void;
}

/**
 * The conversation the HUD is showing, mirrored from the engine.
 *
 * Answering follows the `chatStore.sender` pattern (decision D13): the panel
 * calls an injected callback that raises a request flag on the player's
 * `DialogueComponent`, and `NpcSystem` applies it on the next frame. React never
 * mutates ECS state, which is exactly what keeps this mirror from drifting out of
 * step with the engine's own idea of where the conversation is.
 */
export const useDialogueStore = create<DialogueState>((set, get) => ({
  npcId: null,
  nameKey: null,
  textKey: null,
  options: [],
  responder: null,
  closer: null,

  setSnapshot: (snapshot) =>
    set({
      npcId: snapshot.npcId,
      nameKey: snapshot.nameKey,
      textKey: snapshot.textKey,
      options: snapshot.options,
    }),

  setCallbacks: (responder, closer) => set({ responder, closer }),

  // Wrapped rather than exposed raw so no caller has to null-check: before the
  // game has booted, answering is simply a no-op.
  respond: (optionIndex) => get().responder?.(optionIndex),

  close: () => get().closer?.(),
}));

/** Whether a conversation is open. Read by the input gate every frame. */
export function isDialogueOpen(): boolean {
  return useDialogueStore.getState().npcId !== null;
}

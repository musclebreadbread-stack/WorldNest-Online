import Phaser from "phaser";
import { MAX_DIALOGUE_OPTIONS } from "@worldnest/game-engine";
import { HOTBAR_SLOTS } from "@worldnest/shared";
import { closeTopmostPanel, isHudModal, isTyping } from "./panelStack";
import { isDialogueOpen, useDialogueStore } from "../stores/dialogueStore";
import { useUIStore } from "../stores/uiStore";

/**
 * Every keyboard binding that fires once per press.
 *
 * Split out of `PlayerController` because that file had grown to the ~300-line
 * cap `CONTRIBUTING.md` sets: the controller now owns movement, facing and the
 * request helpers, and a new key is one row in the table below. The gates the
 * rows share live in `panelStack.ts`, which imports no Phaser and is therefore
 * testable on its own.
 */

/** What a one-shot key is allowed to ask the player entity to do. */
export interface OneShotActions {
  interact(): void;
  build(): void;
  selectHotbarSlot(index: number): void;
}

interface OneShotBinding {
  keyCode: number;
  handler: (actions: OneShotActions) => void;
}

/**
 * Panel toggles and world actions, one row per key.
 *
 * Handlers take an `OneShotActions` object rather than the controller: a
 * module-level table calling `controller.requestInteract()` would have forced
 * those helpers public, and TypeScript's `private` is class-scoped.
 */
const ONE_SHOT_BINDINGS: OneShotBinding[] = [
  {
    keyCode: Phaser.Input.Keyboard.KeyCodes.I,
    handler: () => useUIStore.getState().toggleInventory(),
  },
  {
    keyCode: Phaser.Input.Keyboard.KeyCodes.B,
    handler: () => useUIStore.getState().toggleBuildMode(),
  },
  {
    keyCode: Phaser.Input.Keyboard.KeyCodes.M,
    handler: () => useUIStore.getState().toggleMinimap(),
  },
  {
    keyCode: Phaser.Input.Keyboard.KeyCodes.P,
    handler: () => useUIStore.getState().toggleSettings(),
  },
  // E and Space both act on the faced tile
  {
    keyCode: Phaser.Input.Keyboard.KeyCodes.E,
    handler: (actions) => actions.interact(),
  },
  {
    keyCode: Phaser.Input.Keyboard.KeyCodes.SPACE,
    handler: (actions) => actions.interact(),
  },
  // Q places the selected item, but only in build mode
  {
    keyCode: Phaser.Input.Keyboard.KeyCodes.Q,
    handler: (actions) => actions.build(),
  },
];

/**
 * Bind every one-shot key. Movement keys are polled by the controller instead,
 * because a held key has to be readable every frame.
 */
export function bindOneShotKeys(
  keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
  actions: OneShotActions,
): void {
  // Number keys 1..8 select the matching hotbar slot, or answer an open
  // conversation. They are bound outside `whenPlaying` because that gate
  // suppresses everything while a dialogue is up, and answering it is the one
  // thing that must still work.
  for (let index = 0; index < HOTBAR_SLOTS; index++) {
    const key = addUncapturedKey(keyboard, Phaser.Input.Keyboard.KeyCodes.ONE + index);
    key.on("down", () => pressNumber(actions, index));
  }

  for (const binding of ONE_SHOT_BINDINGS) {
    addUncapturedKey(keyboard, binding.keyCode).on(
      "down",
      whenPlaying(() => binding.handler(actions)),
    );
  }

  // Escape is bound outside the gate as well: closing whatever is on top is the
  // one thing it has to be able to do while the HUD holds the keyboard.
  addUncapturedKey(keyboard, Phaser.Input.Keyboard.KeyCodes.ESC).on("down", () => {
    if (isTyping()) return;

    closeTopmostPanel();
  });
}

/** Wrap a key handler so it is ignored while the HUD owns the keyboard. */
export function whenPlaying(handler: () => void): () => void {
  return () => {
    if (isHudModal()) return;

    handler();
  };
}

/**
 * Bind a key without Phaser's default capture.
 *
 * Capture calls `preventDefault()` on the browser event, which would swallow
 * every character typed into the chat input — including spaces and the letters
 * bound to game actions. None of these keys have browser behaviour worth
 * suppressing, unlike the arrow keys bound by `createCursorKeys`.
 */
export function addUncapturedKey(
  keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
  keyCode: number,
): Phaser.Input.Keyboard.Key {
  return keyboard.addKey(keyCode, false);
}

/**
 * A number key: an answer while a conversation is open, a hotbar slot otherwise.
 * Only the first `MAX_DIALOGUE_OPTIONS` have an option to pick, and the rest do
 * nothing rather than silently changing the selection behind the panel.
 */
function pressNumber(actions: OneShotActions, index: number): void {
  if (isTyping()) return;

  if (isDialogueOpen()) {
    if (index < MAX_DIALOGUE_OPTIONS) useDialogueStore.getState().respond(index);
    return;
  }

  actions.selectHotbarSlot(index);
}

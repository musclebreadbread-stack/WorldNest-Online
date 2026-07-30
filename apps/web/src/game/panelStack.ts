import { useChatStore } from "../stores/chatStore";
import { isDialogueOpen, useDialogueStore } from "../stores/dialogueStore";
import { isShopOpen, useShopStore } from "../stores/shopStore";
import { useUIStore } from "../stores/uiStore";

/**
 * Which HUD surface currently owns the keyboard, and how to close it.
 *
 * Deliberately Phaser-free — the same split `Minimap.ts` and `minimapLayout.ts`
 * use — because these are pure store rules and they are what `Escape` and every
 * input gate are judged by. `keyBindings.ts` binds the keys; this file decides
 * what a key is allowed to do, and it is testable under jsdom.
 */

/** Whether the chat composer currently holds keyboard focus. */
export function isTyping(): boolean {
  return useChatStore.getState().inputFocused;
}

/**
 * Whether the HUD, rather than the world, owns the keyboard: the chat composer
 * has focus, or a conversation or a shop is open. `Escape` is deliberately bound
 * outside this gate, because closing them is how the player gets out.
 */
export function isHudModal(): boolean {
  return isTyping() || isDialogueOpen() || isShopOpen();
}

/**
 * Close whatever is on top, and report whether anything was closed.
 *
 * Precedence is "most modal first": a conversation owns the keyboard outright,
 * then the shop it can lead to, then the windows a player opens for themselves
 * (quest log, inventory, settings), and build mode last because it is a mode
 * rather than a window. One press closes exactly one thing. Chat is not in the
 * list — the composer blurs itself on `Escape`, which is why the key handler
 * returns early while it has focus.
 */
export function closeTopmostPanel(): boolean {
  if (isDialogueOpen()) {
    useDialogueStore.getState().close();
    return true;
  }
  if (isShopOpen()) {
    useShopStore.getState().close();
    return true;
  }

  const ui = useUIStore.getState();
  if (ui.questLogOpen) {
    ui.setQuestLogOpen(false);
    return true;
  }
  if (ui.inventoryOpen) {
    ui.setInventoryOpen(false);
    return true;
  }
  if (ui.settingsOpen) {
    ui.setSettingsOpen(false);
    return true;
  }
  if (ui.buildMode) {
    ui.setBuildMode(false);
    return true;
  }

  return false;
}

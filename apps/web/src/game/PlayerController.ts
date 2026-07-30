import Phaser from "phaser";
import { MAX_DIALOGUE_OPTIONS, selectSlot } from "@worldnest/game-engine";
import type {
  Entity,
  Facing,
  InputComponent,
  InteractionComponent,
  InventoryComponent,
} from "@worldnest/game-engine";
import { HOTBAR_SLOTS } from "@worldnest/shared";
import { mergeInput, TOUCH_DEADZONE } from "./inputMerge";
import { useChatStore } from "../stores/chatStore";
import { isDialogueOpen, useDialogueStore } from "../stores/dialogueStore";
import { useTouchStore } from "../stores/touchStore";
import { useUIStore } from "../stores/uiStore";

/** Minimum gap between interaction requests, so a held key does not spam. */
const INTERACT_COOLDOWN_MS = 250;

/**
 * A key that fires once per press, and what it does.
 *
 * Declarative on purpose: every later feature (the minimap, settings, dialogue,
 * the shop, the quest log) adds one row here instead of another `addKey(...).on(...)`
 * block, which is what keeps this file well under the ~300-line cap while staying
 * the single place keyboard input is defined.
 */
interface OneShotActions {
  interact(): void;
  build(): void;
}

interface OneShotBinding {
  keyCode: number;
  handler: (actions: OneShotActions) => void;
}

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
 * PlayerController translates Phaser keyboard state into ECS components.
 *
 * Movement keys are polled every frame into the InputComponent, while one-shot
 * keys (hotbar selection, panel toggles) are handled as key-down events. Keeping
 * this out of GameScene keeps the scene focused on rendering and networking.
 */
export class PlayerController {
  private playerEntity: Entity;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private moveKeys: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key> | null =
    null;

  constructor(scene: Phaser.Scene, playerEntity: Entity) {
    this.playerEntity = playerEntity;

    const keyboard = scene.input.keyboard;
    if (!keyboard) return;

    this.cursors = keyboard.createCursorKeys();
    this.moveKeys = {
      W: addUncapturedKey(keyboard, Phaser.Input.Keyboard.KeyCodes.W),
      A: addUncapturedKey(keyboard, Phaser.Input.Keyboard.KeyCodes.A),
      S: addUncapturedKey(keyboard, Phaser.Input.Keyboard.KeyCodes.S),
      D: addUncapturedKey(keyboard, Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Number keys 1..8 select the matching hotbar slot, or answer an open
    // conversation. They are bound outside `whenPlaying` because that gate now
    // suppresses everything while a dialogue is up, and answering it is the one
    // thing that must still work.
    for (let index = 0; index < HOTBAR_SLOTS; index++) {
      const key = addUncapturedKey(keyboard, Phaser.Input.Keyboard.KeyCodes.ONE + index);
      key.on("down", () => this.pressNumber(index));
    }

    // Panel toggles and world actions, one row per key
    const actions: OneShotActions = {
      interact: () => this.requestInteract(),
      build: () => this.requestBuild(),
    };
    for (const binding of ONE_SHOT_BINDINGS) {
      addUncapturedKey(keyboard, binding.keyCode).on(
        "down",
        this.whenPlaying(() => binding.handler(actions)),
      );
    }

    // Left-click places the selected item too, on the same build-mode gate
    scene.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      this.whenPlaying(() => this.requestBuild()),
    );
  }

  /**
   * Poll held keys and the virtual stick into the input component, and act on any
   * touch button tapped since the last frame. Call once per frame.
   */
  update(): void {
    if (!this.cursors || !this.moveKeys) return;

    const input = this.playerEntity.getComponent<InputComponent>("input")!;
    const touch = useTouchStore.getState();
    // Consumed before the typing gate so a tap that arrives while the composer
    // has focus is dropped, exactly as `whenPlaying` drops a keypress.
    const requests = touch.consumeRequests();

    // While the chat input has focus the movement keys are typing, not walking,
    // and while a conversation is open the player is standing still by definition
    if (isTyping() || isDialogueOpen()) {
      input.keys.up = false;
      input.keys.down = false;
      input.keys.left = false;
      input.keys.right = false;
      return;
    }

    const merged = mergeInput(
      {
        up: this.cursors.up.isDown || this.moveKeys.W.isDown,
        down: this.cursors.down.isDown || this.moveKeys.S.isDown,
        left: this.cursors.left.isDown || this.moveKeys.A.isDown,
        right: this.cursors.right.isDown || this.moveKeys.D.isDown,
      },
      touch.axisX,
      touch.axisY,
      TOUCH_DEADZONE,
    );
    input.keys.up = merged.up;
    input.keys.down = merged.down;
    input.keys.left = merged.left;
    input.keys.right = merged.right;

    this.updateFacing(input);

    // Touch goes through the same cooldown-gated helpers as `E` and `Q`, so a
    // tapping thumb cannot act faster than a held key.
    if (requests.interact) this.requestInteract();
    if (requests.build) this.requestBuild();
  }

  /**
   * Keep the interaction facing on the last non-zero direction, so releasing the
   * keys leaves the player still aimed at the tile they walked towards.
   * Vertical keys win ties, matching how the sprite would be drawn.
   */
  private updateFacing(input: InputComponent): void {
    const facing = directionFromKeys(input.keys);
    if (!facing) return;

    const interaction =
      this.playerEntity.getComponent<InteractionComponent>("interaction");
    if (!interaction) return;

    interaction.facing = facing;
  }

  private requestInteract(): void {
    const interaction =
      this.playerEntity.getComponent<InteractionComponent>("interaction");
    if (!interaction) return;

    const now = Date.now();
    if (now - interaction.lastInteractAt < INTERACT_COOLDOWN_MS) return;

    interaction.lastInteractAt = now;
    interaction.interactRequested = true;
  }

  /**
   * Ask BuildSystem to place the selected item. Gated on build mode so a stray
   * click never spends an item, and on the same cooldown as interacting.
   */
  private requestBuild(): void {
    if (!useUIStore.getState().buildMode) return;

    const interaction =
      this.playerEntity.getComponent<InteractionComponent>("interaction");
    if (!interaction) return;

    const now = Date.now();
    if (now - interaction.lastBuildAt < INTERACT_COOLDOWN_MS) return;

    interaction.lastBuildAt = now;
    interaction.buildRequested = true;
  }

  /**
   * A number key: an answer while a conversation is open, a hotbar slot otherwise.
   * Only the first `MAX_DIALOGUE_OPTIONS` have an option to pick, and the rest do
   * nothing rather than silently changing the selection behind the panel.
   */
  private pressNumber(index: number): void {
    if (isTyping()) return;

    if (isDialogueOpen()) {
      if (index < MAX_DIALOGUE_OPTIONS) useDialogueStore.getState().respond(index);
      return;
    }

    this.selectHotbarSlot(index);
  }

  private selectHotbarSlot(index: number): void {
    const inventory = this.playerEntity.getComponent<InventoryComponent>("inventory");
    if (!inventory) return;

    selectSlot(inventory, index);
  }

  /**
   * Wrap a key handler so it is ignored while the player is typing in chat or
   * talking to an NPC. Both are states where the keyboard belongs to the HUD.
   */
  private whenPlaying(handler: () => void): () => void {
    return () => {
      if (isTyping() || isDialogueOpen()) return;

      handler();
    };
  }
}

/** Whether the chat composer currently holds keyboard focus. */
function isTyping(): boolean {
  return useChatStore.getState().inputFocused;
}

/**
 * Bind a key without Phaser's default capture.
 *
 * Capture calls `preventDefault()` on the browser event, which would swallow
 * every character typed into the chat input — including spaces and the letters
 * bound to game actions. None of these keys have browser behaviour worth
 * suppressing, unlike the arrow keys bound by `createCursorKeys`.
 */
function addUncapturedKey(
  keyboard: Phaser.Input.Keyboard.KeyboardPlugin,
  keyCode: number,
): Phaser.Input.Keyboard.Key {
  return keyboard.addKey(keyCode, false);
}

/** Facing implied by the currently held movement keys, or `null` when idle. */
function directionFromKeys(keys: InputComponent["keys"]): Facing | null {
  if (keys.up) return "up";
  if (keys.down) return "down";
  if (keys.left) return "left";
  if (keys.right) return "right";
  return null;
}

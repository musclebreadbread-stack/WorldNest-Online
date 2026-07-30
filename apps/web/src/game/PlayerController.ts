import Phaser from "phaser";
import { selectSlot } from "@worldnest/game-engine";
import type {
  Entity,
  Facing,
  InputComponent,
  InteractionComponent,
  InventoryComponent,
} from "@worldnest/game-engine";
import { HOTBAR_SLOTS } from "@worldnest/shared";
import { useChatStore } from "../stores/chatStore";
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

    // Number keys 1..8 select the matching hotbar slot
    for (let index = 0; index < HOTBAR_SLOTS; index++) {
      const key = addUncapturedKey(keyboard, Phaser.Input.Keyboard.KeyCodes.ONE + index);
      key.on("down", this.whenPlaying(() => this.selectHotbarSlot(index)));
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

  /** Poll held keys into the input component. Call once per frame. */
  update(): void {
    if (!this.cursors || !this.moveKeys) return;

    const input = this.playerEntity.getComponent<InputComponent>("input")!;

    // While the chat input has focus the movement keys are typing, not walking
    if (isTyping()) {
      input.keys.up = false;
      input.keys.down = false;
      input.keys.left = false;
      input.keys.right = false;
      return;
    }

    input.keys.up = this.cursors.up.isDown || this.moveKeys.W.isDown;
    input.keys.down = this.cursors.down.isDown || this.moveKeys.S.isDown;
    input.keys.left = this.cursors.left.isDown || this.moveKeys.A.isDown;
    input.keys.right = this.cursors.right.isDown || this.moveKeys.D.isDown;

    this.updateFacing(input);
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

  private selectHotbarSlot(index: number): void {
    const inventory = this.playerEntity.getComponent<InventoryComponent>("inventory");
    if (!inventory) return;

    selectSlot(inventory, index);
  }

  /** Wrap a key handler so it is ignored while the player is typing in chat. */
  private whenPlaying(handler: () => void): () => void {
    return () => {
      if (isTyping()) return;

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

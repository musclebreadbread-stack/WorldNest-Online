import Phaser from "phaser";
import { selectSlot } from "@worldnest/game-engine";
import type {
  Entity,
  Facing,
  InputComponent,
  InteractionComponent,
  InventoryComponent,
} from "@worldnest/game-engine";
import { mergeInput, TOUCH_DEADZONE } from "./inputMerge";
import { addUncapturedKey, bindOneShotKeys, isTyping, whenPlaying } from "./keyBindings";
import { isDialogueOpen } from "../stores/dialogueStore";
import { useTouchStore } from "../stores/touchStore";
import { useUIStore } from "../stores/uiStore";

/** Minimum gap between interaction requests, so a held key does not spam. */
const INTERACT_COOLDOWN_MS = 250;

/**
 * PlayerController translates Phaser keyboard state into ECS components.
 *
 * Movement keys are polled every frame into the InputComponent, while every
 * one-shot key lives in `keyBindings.ts` — this class only supplies the actions
 * those keys call. Keeping this out of GameScene keeps the scene focused on
 * rendering and networking.
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

    // Hotbar keys, panel toggles and world actions, all declared as one table
    bindOneShotKeys(keyboard, {
      interact: () => this.requestInteract(),
      build: () => this.requestBuild(),
      selectHotbarSlot: (index) => this.selectHotbarSlot(index),
    });

    // Left-click places the selected item too, on the same build-mode gate
    scene.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      whenPlaying(() => this.requestBuild()),
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

  private selectHotbarSlot(index: number): void {
    const inventory = this.playerEntity.getComponent<InventoryComponent>("inventory");
    if (!inventory) return;

    selectSlot(inventory, index);
  }
}

/** Facing implied by the currently held movement keys, or `null` when idle. */
function directionFromKeys(keys: InputComponent["keys"]): Facing | null {
  if (keys.up) return "up";
  if (keys.down) return "down";
  if (keys.left) return "left";
  if (keys.right) return "right";
  return null;
}

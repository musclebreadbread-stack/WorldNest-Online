import Phaser from "phaser";
import { selectSlot } from "@worldnest/game-engine";
import type { Entity, InputComponent, InventoryComponent } from "@worldnest/game-engine";
import { HOTBAR_SLOTS } from "@worldnest/shared";
import { useUIStore } from "../stores/uiStore";

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
      W: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Number keys 1..8 select the matching hotbar slot
    for (let index = 0; index < HOTBAR_SLOTS; index++) {
      const key = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE + index);
      key.on("down", () => this.selectHotbarSlot(index));
    }

    keyboard
      .addKey(Phaser.Input.Keyboard.KeyCodes.I)
      .on("down", () => useUIStore.getState().toggleInventory());
  }

  /** Poll held keys into the input component. Call once per frame. */
  update(): void {
    if (!this.cursors || !this.moveKeys) return;

    const input = this.playerEntity.getComponent<InputComponent>("input")!;
    input.keys.up = this.cursors.up.isDown || this.moveKeys.W.isDown;
    input.keys.down = this.cursors.down.isDown || this.moveKeys.S.isDown;
    input.keys.left = this.cursors.left.isDown || this.moveKeys.A.isDown;
    input.keys.right = this.cursors.right.isDown || this.moveKeys.D.isDown;
  }

  private selectHotbarSlot(index: number): void {
    const inventory = this.playerEntity.getComponent<InventoryComponent>("inventory");
    if (!inventory) return;

    selectSlot(inventory, index);
  }
}

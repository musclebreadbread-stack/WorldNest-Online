import type {
  Entity,
  InventoryComponent,
  PositionComponent,
  StatsComponent,
  TimeComponent,
} from "@worldnest/game-engine";
import {
  CLOCK_CHANGED_EVENT,
  INVENTORY_CHANGED_EVENT,
  PLAYER_POSITION_EVENT,
  STATS_CHANGED_EVENT,
  type InventoryChangedEvent,
  type PlayerPositionEvent,
  type StatsChangedEvent,
} from "./events";

/** The slice of Phaser's event emitter the bridge needs, so it stays Phaser-free. */
export interface HudEventEmitter {
  emit(event: string, payload: unknown): unknown;
}

/**
 * HudBridge pushes ECS state to React as `game.events`.
 * It keeps the last emitted values so slow-changing state (the world clock) is
 * only published when it actually changes, instead of 60 times a second.
 */
export class HudBridge {
  private emitter: HudEventEmitter;
  private playerEntity: Entity;
  private clockEntity: Entity;
  private lastClockMinutes = -1;
  private lastInventoryVersion = -1;
  private lastHealth = -1;
  private lastEnergy = -1;

  constructor(emitter: HudEventEmitter, playerEntity: Entity, clockEntity: Entity) {
    this.emitter = emitter;
    this.playerEntity = playerEntity;
    this.clockEntity = clockEntity;
  }

  /** Emit everything that changed. Call once per frame, after the ECS update. */
  flush(): void {
    this.emitPosition();
    this.emitClock();
    this.emitInventory();
    this.emitStats();
  }

  private emitPosition(): void {
    const position = this.playerEntity.getComponent<PositionComponent>("position")!;
    const payload: PlayerPositionEvent = {
      x: position.x,
      y: position.y,
      chunkX: position.chunkX,
      chunkY: position.chunkY,
    };
    this.emitter.emit(PLAYER_POSITION_EVENT, payload);
  }

  private emitClock(): void {
    const snapshot = this.clockEntity.getComponent<TimeComponent>("time")!.snapshot;
    if (snapshot.totalMinutes === this.lastClockMinutes) return;

    this.lastClockMinutes = snapshot.totalMinutes;
    this.emitter.emit(CLOCK_CHANGED_EVENT, snapshot);
  }

  private emitInventory(): void {
    const inventory = this.playerEntity.getComponent<InventoryComponent>("inventory")!;
    if (inventory.version === this.lastInventoryVersion) return;

    this.lastInventoryVersion = inventory.version;
    const payload: InventoryChangedEvent = {
      slots: inventory.slots,
      selectedSlot: inventory.selectedSlot,
    };
    this.emitter.emit(INVENTORY_CHANGED_EVENT, payload);
  }

  /**
   * Energy regenerates continuously, so the bars are published on whole-point
   * changes only — that is all the HUD can display anyway.
   */
  private emitStats(): void {
    const stats = this.playerEntity.getComponent<StatsComponent>("stats")!;
    const health = Math.round(stats.health);
    const energy = Math.round(stats.energy);
    if (health === this.lastHealth && energy === this.lastEnergy) return;

    this.lastHealth = health;
    this.lastEnergy = energy;
    const payload: StatsChangedEvent = {
      health,
      maxHealth: stats.maxHealth,
      energy,
      maxEnergy: stats.maxEnergy,
    };
    this.emitter.emit(STATS_CHANGED_EVENT, payload);
  }
}

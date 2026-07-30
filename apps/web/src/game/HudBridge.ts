import type { Entity, PositionComponent, TimeComponent } from "@worldnest/game-engine";
import {
  CLOCK_CHANGED_EVENT,
  PLAYER_POSITION_EVENT,
  type PlayerPositionEvent,
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

  constructor(emitter: HudEventEmitter, playerEntity: Entity, clockEntity: Entity) {
    this.emitter = emitter;
    this.playerEntity = playerEntity;
    this.clockEntity = clockEntity;
  }

  /** Emit everything that changed. Call once per frame, after the ECS update. */
  flush(): void {
    this.emitPosition();
    this.emitClock();
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
}

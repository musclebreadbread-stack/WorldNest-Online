import { describe, it, expect, beforeEach } from "vitest";
import { TimeComponent, WorldClock } from "@worldnest/game-engine";
import { DAY_LENGTH_MINUTES, WORLD_EPOCH_MS } from "@worldnest/shared";
import { HudBridge, type HudEventEmitter } from "../game/HudBridge";
import { createGameWorld, DEFAULT_SPAWN_X, DEFAULT_SPAWN_Y } from "../game/createGameWorld";
import { CLOCK_CHANGED_EVENT, PLAYER_POSITION_EVENT } from "../game/events";

class RecordingEmitter implements HudEventEmitter {
  public events: Array<{ event: string; payload: unknown }> = [];

  emit(event: string, payload: unknown): unknown {
    this.events.push({ event, payload });
    return true;
  }

  countOf(event: string): number {
    return this.events.filter((entry) => entry.event === event).length;
  }
}

const BOOTSTRAP = {
  playerId: "user-1",
  username: "Tester",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
};

describe("HudBridge", () => {
  let emitter: RecordingEmitter;

  beforeEach(() => {
    emitter = new RecordingEmitter();
  });

  it("should emit the player position every flush", () => {
    const { playerEntity, clockEntity } = createGameWorld(BOOTSTRAP);
    const bridge = new HudBridge(emitter, playerEntity, clockEntity);

    bridge.flush();
    bridge.flush();

    expect(emitter.countOf(PLAYER_POSITION_EVENT)).toBe(2);
    expect(emitter.events[0].payload).toEqual({
      x: DEFAULT_SPAWN_X,
      y: DEFAULT_SPAWN_Y,
      chunkX: 0,
      chunkY: 0,
    });
  });

  it("should emit the clock only when it changes", () => {
    const { playerEntity, clockEntity } = createGameWorld(BOOTSTRAP);
    const time = clockEntity.getComponent<TimeComponent>("time")!;
    time.snapshot = WorldClock.fromWallClock(WORLD_EPOCH_MS);
    const bridge = new HudBridge(emitter, playerEntity, clockEntity);

    bridge.flush();
    bridge.flush();
    expect(emitter.countOf(CLOCK_CHANGED_EVENT)).toBe(1);

    time.snapshot = WorldClock.fromWallClock(
      WORLD_EPOCH_MS + DAY_LENGTH_MINUTES * 1000,
    );
    bridge.flush();

    expect(emitter.countOf(CLOCK_CHANGED_EVENT)).toBe(2);
    expect(
      emitter.events
        .filter((entry) => entry.event === CLOCK_CHANGED_EVENT)
        .map((entry) => (entry.payload as { day: number }).day),
    ).toEqual([1, 2]);
  });
});

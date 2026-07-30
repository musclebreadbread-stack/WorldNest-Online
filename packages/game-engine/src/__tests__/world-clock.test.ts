import { describe, it, expect } from "vitest";
import {
  DAY_LENGTH_MINUTES,
  GAME_MINUTES_PER_REAL_SECOND,
  WORLD_EPOCH_MS,
} from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { TimeComponent } from "../components/TimeComponent";
import { PositionComponent } from "../components/PositionComponent";
import { TimeSystem } from "../systems/TimeSystem";
import { WorldClock, type DayPhase } from "../world/WorldClock";

/** Wall-clock timestamp for a given in-game day/hour/minute. */
function wallClockAt(day: number, hour: number, minute: number): number {
  const totalMinutes = (day - 1) * DAY_LENGTH_MINUTES + hour * 60 + minute;
  return WORLD_EPOCH_MS + (totalMinutes / GAME_MINUTES_PER_REAL_SECOND) * 1000;
}

describe("WorldClock.fromWallClock", () => {
  it("should place the epoch at day 1, 00:00", () => {
    const snapshot = WorldClock.fromWallClock(WORLD_EPOCH_MS);

    expect(snapshot).toEqual({
      totalMinutes: 0,
      day: 1,
      hour: 0,
      minute: 0,
      phase: "night",
    });
  });

  it("should clamp timestamps before the epoch to the start of day 1", () => {
    const snapshot = WorldClock.fromWallClock(WORLD_EPOCH_MS - 60_000);

    expect(snapshot.totalMinutes).toBe(0);
    expect(snapshot.day).toBe(1);
  });

  it("should convert elapsed real seconds into game minutes", () => {
    const snapshot = WorldClock.fromWallClock(wallClockAt(1, 7, 20));

    expect(snapshot.totalMinutes).toBe(7 * 60 + 20);
    expect(snapshot.hour).toBe(7);
    expect(snapshot.minute).toBe(20);
  });

  it.each<[number, number, DayPhase]>([
    [0, 0, "night"],
    [4, 59, "night"],
    [5, 0, "dawn"],
    [7, 59, "dawn"],
    [8, 0, "day"],
    [17, 59, "day"],
    [18, 0, "dusk"],
    [20, 59, "dusk"],
    [21, 0, "night"],
    [23, 59, "night"],
  ])("should bucket %i:%i into the %s phase", (hour, minute, phase) => {
    expect(WorldClock.fromWallClock(wallClockAt(1, hour, minute)).phase).toBe(phase);
  });

  it("should wrap to day 2 after a full day", () => {
    const snapshot = WorldClock.fromWallClock(wallClockAt(2, 0, 0));

    expect(snapshot.totalMinutes).toBe(DAY_LENGTH_MINUTES);
    expect(snapshot.day).toBe(2);
    expect(snapshot.hour).toBe(0);
    expect(snapshot.minute).toBe(0);
  });

  it("should be identical for two clients reading the same timestamp", () => {
    const nowMs = wallClockAt(4, 13, 37);

    expect(WorldClock.fromWallClock(nowMs)).toEqual(WorldClock.fromWallClock(nowMs));
  });
});

describe("TimeSystem", () => {
  it("should only match entities with a time component", () => {
    const system = new TimeSystem(() => WORLD_EPOCH_MS);
    const clockEntity = new Entity("world-clock").addComponent(new TimeComponent());
    const other = new Entity("player").addComponent(new PositionComponent(0, 0));

    expect(system.matches(clockEntity)).toBe(true);
    expect(system.matches(other)).toBe(false);
  });

  it("should refresh the snapshot from the injected clock", () => {
    let now = wallClockAt(1, 6, 0);
    const system = new TimeSystem(() => now);
    const entity = new Entity("world-clock").addComponent(new TimeComponent());

    system.update([entity], 0);
    expect(entity.getComponent<TimeComponent>("time")!.snapshot.phase).toBe("dawn");

    now = wallClockAt(1, 22, 0);
    system.update([entity], 0);

    const snapshot = entity.getComponent<TimeComponent>("time")!.snapshot;
    expect(snapshot.hour).toBe(22);
    expect(snapshot.phase).toBe("night");
  });

  it("should give every clock entity the same snapshot instance", () => {
    const system = new TimeSystem(() => wallClockAt(3, 9, 0));
    const a = new Entity("clock-a").addComponent(new TimeComponent());
    const b = new Entity("clock-b").addComponent(new TimeComponent());

    system.update([a, b], 0);

    expect(a.getComponent<TimeComponent>("time")!.snapshot).toBe(
      b.getComponent<TimeComponent>("time")!.snapshot,
    );
  });
});

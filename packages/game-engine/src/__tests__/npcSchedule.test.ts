import { describe, it, expect } from "vitest";
import { NPC_DEFINITIONS } from "../world/NpcCatalogue";
import { scheduledEntry, type NpcScheduleEntry } from "../world/npcSchedule";
import type { ClockSnapshot } from "../world/WorldClock";

function makeSnapshot(hour: number, minute = 0): ClockSnapshot {
  return {
    totalMinutes: hour * 60 + minute,
    day: 1,
    hour,
    minute,
    phase: "day",
  };
}

describe("scheduledEntry", () => {
  const schedule: NpcScheduleEntry[] = [
    { fromHour: 0, activity: "rest", tileX: 1, tileY: 1 },
    { fromHour: 6, activity: "work", tileX: 2, tileY: 2 },
    { fromHour: 12, activity: "home", tileX: 3, tileY: 3 },
    { fromHour: 19, activity: "rest", tileX: 4, tileY: 4 },
  ];

  it("should return the correct entry for each hour boundary", () => {
    expect(scheduledEntry(schedule, makeSnapshot(0))).toBe(schedule[0]);
    expect(scheduledEntry(schedule, makeSnapshot(5))).toBe(schedule[0]);
    expect(scheduledEntry(schedule, makeSnapshot(6))).toBe(schedule[1]);
    expect(scheduledEntry(schedule, makeSnapshot(11))).toBe(schedule[1]);
    expect(scheduledEntry(schedule, makeSnapshot(12))).toBe(schedule[2]);
    expect(scheduledEntry(schedule, makeSnapshot(18))).toBe(schedule[2]);
    expect(scheduledEntry(schedule, makeSnapshot(19))).toBe(schedule[3]);
    expect(scheduledEntry(schedule, makeSnapshot(23))).toBe(schedule[3]);
  });

  it("should be total over all 24 hours for every catalogued schedule", () => {
    for (const definition of NPC_DEFINITIONS) {
      if (!definition.schedule) continue;
      for (let hour = 0; hour < 24; hour++) {
        const entry = scheduledEntry(definition.schedule, makeSnapshot(hour));
        expect(entry, `${definition.id} at hour ${hour}`).toBeDefined();
        expect(entry.activity).toMatch(
          /^(home|work|market|rest|museum|cooking|ranch)$/,
        );
      }
    }
  });

  it("should wrap past midnight to the last entry of the day", () => {
    // A schedule that starts at hour 8 (no 0 entry) should wrap to last
    const lateSchedule: NpcScheduleEntry[] = [
      { fromHour: 8, activity: "work", tileX: 1, tileY: 1 },
      { fromHour: 20, activity: "rest", tileX: 2, tileY: 2 },
    ];
    // At hour 3, before the first entry - should get the last (wrapping)
    expect(scheduledEntry(lateSchedule, makeSnapshot(3))).toBe(lateSchedule[1]);
  });

  it("should be deterministic for the same arguments", () => {
    for (const definition of NPC_DEFINITIONS) {
      if (!definition.schedule) continue;
      const snap = makeSnapshot(10, 30);
      const a = scheduledEntry(definition.schedule, snap);
      const b = scheduledEntry(definition.schedule, snap);
      expect(a).toBe(b);
    }
  });

  it("should have sorted schedules starting at hour 0 for every NPC", () => {
    for (const definition of NPC_DEFINITIONS) {
      if (!definition.schedule) continue;
      expect(
        definition.schedule[0].fromHour,
        `${definition.id} schedule starts at 0`,
      ).toBe(0);
      for (let i = 1; i < definition.schedule.length; i++) {
        expect(
          definition.schedule[i].fromHour,
          `${definition.id} schedule sorted`,
        ).toBeGreaterThan(definition.schedule[i - 1].fromHour);
      }
    }
  });

  it("should use only valid activities", () => {
    const validActivities = new Set([
      "home",
      "work",
      "market",
      "rest",
      "museum",
      "cooking",
      "ranch",
    ]);
    for (const definition of NPC_DEFINITIONS) {
      if (!definition.schedule) continue;
      for (const entry of definition.schedule) {
        expect(validActivities.has(entry.activity), entry.activity).toBe(true);
      }
    }
  });
});

import { describe, it, expect } from "vitest";
import type { ClockSnapshot } from "@worldnest/game-engine";
import { formatClock } from "../lib/formatClock";

function snapshot(overrides: Partial<ClockSnapshot> = {}): ClockSnapshot {
  return {
    totalMinutes: 0,
    day: 1,
    hour: 0,
    minute: 0,
    phase: "night",
    ...overrides,
  };
}

describe("formatClock", () => {
  it("should render day, time and phase", () => {
    expect(formatClock(snapshot({ day: 3, hour: 7, minute: 20, phase: "dawn" }))).toBe(
      "Day 3 · 07:20 · dawn",
    );
  });

  it("should zero-pad hours and minutes", () => {
    expect(formatClock(snapshot({ day: 1, hour: 0, minute: 5 }))).toBe(
      "Day 1 · 00:05 · night",
    );
  });

  it("should not pad two digit values", () => {
    expect(formatClock(snapshot({ day: 12, hour: 18, minute: 45, phase: "dusk" }))).toBe(
      "Day 12 · 18:45 · dusk",
    );
  });
});

import { describe, it, expect } from "vitest";
import type { ClockSnapshot } from "@worldnest/game-engine";
import { CLOCK_PHASE_KEYS, translate } from "../i18n";
import { formatTime } from "../lib/formatClock";

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

describe("formatTime", () => {
  it("should zero-pad hours and minutes", () => {
    expect(formatTime(snapshot({ hour: 7, minute: 20 }))).toBe("07:20");
    expect(formatTime(snapshot({ hour: 0, minute: 5 }))).toBe("00:05");
  });

  it("should not pad two digit values", () => {
    expect(formatTime(snapshot({ hour: 18, minute: 45 }))).toBe("18:45");
  });
});

describe("clock readout", () => {
  it("should compose day, time and phase through the catalogue", () => {
    const clock = snapshot({ day: 3, hour: 7, minute: 20, phase: "dawn" });

    const readout = translate("en", "clock.format", {
      day: clock.day,
      time: formatTime(clock),
      phase: translate("en", CLOCK_PHASE_KEYS[clock.phase]),
    });

    expect(readout).toBe("Day 3 · 07:20 · dawn");
  });

  it("should follow the locale's own word order", () => {
    const clock = snapshot({ day: 12, hour: 18, minute: 45, phase: "dusk" });

    const readout = translate("ko", "clock.format", {
      day: clock.day,
      time: formatTime(clock),
      phase: translate("ko", CLOCK_PHASE_KEYS[clock.phase]),
    });

    expect(readout).toBe("12일차 · 18:45 · 저녁");
  });

  it("should have a phase key for every phase the engine reports", () => {
    expect(Object.keys(CLOCK_PHASE_KEYS).sort()).toEqual(
      ["dawn", "dusk", "day", "night"].sort(),
    );
  });
});

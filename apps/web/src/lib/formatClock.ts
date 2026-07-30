import type { ClockSnapshot } from "@worldnest/game-engine";

/** Zero-padded two digit number, e.g. `7` → `"07"`. */
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Human readable form of a world clock snapshot, e.g. `Day 3 · 07:20 · dawn`.
 * Pure so the HUD formatting is unit-testable without React or Phaser.
 */
export function formatClock(snapshot: ClockSnapshot): string {
  return `Day ${snapshot.day} · ${pad2(snapshot.hour)}:${pad2(snapshot.minute)} · ${snapshot.phase}`;
}

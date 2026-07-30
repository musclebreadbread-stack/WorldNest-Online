import type { ClockSnapshot } from "@worldnest/game-engine";

/** Zero-padded two digit number, e.g. `7` → `"07"`. */
function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Wall-clock part of a world clock snapshot, e.g. `"07:20"`.
 *
 * Only the time is formatted here. The day counter and the phase name are
 * translated, so `ClockHud` composes them through the `clock.format` message
 * instead — word order differs between locales.
 */
export function formatTime(snapshot: ClockSnapshot): string {
  return `${pad2(snapshot.hour)}:${pad2(snapshot.minute)}`;
}

/**
 * NPC schedules, derived from the wall clock (decision D15).
 *
 * A schedule is a pure function of the clock: `scheduledEntry(schedule, snapshot)`
 * picks the last entry whose `fromHour` is at or before the clock's hour, wrapping
 * past midnight to the final entry of the day. Every client computes the same
 * anchor for the same minute with zero coordination.
 */
import type { ClockSnapshot } from "./WorldClock";

export type NpcActivity =
  | "home"
  | "work"
  | "market"
  | "rest"
  | "museum"
  | "cooking"
  | "ranch"
  | "teaching"
  | "gardening";

export interface NpcScheduleEntry {
  fromHour: number;
  activity: NpcActivity;
  tileX: number;
  tileY: number;
}

/**
 * The active entry for a clock snapshot. The schedule must be sorted by
 * `fromHour` ascending and start at hour 0.
 *
 * When the clock is before the first entry (impossible for a valid schedule
 * starting at 0, but guarded), returns the last entry of the day.
 */
export function scheduledEntry(
  schedule: readonly NpcScheduleEntry[],
  snapshot: ClockSnapshot,
): NpcScheduleEntry {
  const hour = snapshot.hour;

  // Walk backward through the schedule and pick the last entry whose
  // fromHour is at or before the current hour.
  for (let i = schedule.length - 1; i >= 0; i--) {
    if (schedule[i].fromHour <= hour) return schedule[i];
  }

  // Wrap past midnight: the final entry of the previous day applies.
  return schedule[schedule.length - 1];
}

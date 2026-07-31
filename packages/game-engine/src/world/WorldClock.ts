import {
  DAY_LENGTH_MINUTES,
  GAME_MINUTES_PER_REAL_SECOND,
  WORLD_EPOCH_MS,
} from "@worldnest/shared";

/** Coarse time-of-day bucket used for lighting and gameplay modifiers. */
export type DayPhase = "dawn" | "day" | "dusk" | "night";

export interface ClockSnapshot {
  /** Game minutes elapsed since `WORLD_EPOCH_MS`. */
  totalMinutes: number;
  /** 1-based day counter; the epoch itself is day 1. */
  day: number;
  hour: number;
  minute: number;
  phase: DayPhase;
}

/** Hour each phase starts at. `night` wraps past midnight. */
export const PHASE_START_HOURS: Record<DayPhase, number> = {
  dawn: 5,
  day: 8,
  dusk: 18,
  night: 21,
};

const MINUTES_PER_HOUR = 60;

/**
 * WorldClock derives the shared game time from wall-clock time rather than from
 * accumulated frame deltas: every client computes the same value from
 * `Date.now() - WORLD_EPOCH_MS`, so day/night and crop growth agree with zero
 * server coordination. Accumulated-delta clocks drift per client instead.
 */
export class WorldClock {
  /**
   * Snapshot of the game clock for a wall-clock timestamp in milliseconds.
   * Timestamps before the epoch clamp to the start of day 1.
   */
  static fromWallClock(nowMs: number): ClockSnapshot {
    const elapsedRealSeconds = Math.max(0, nowMs - WORLD_EPOCH_MS) / 1000;
    const totalMinutes = Math.floor(elapsedRealSeconds * GAME_MINUTES_PER_REAL_SECOND);
    const minuteOfDay = totalMinutes % DAY_LENGTH_MINUTES;
    const hour = Math.floor(minuteOfDay / MINUTES_PER_HOUR);

    return {
      totalMinutes,
      day: Math.floor(totalMinutes / DAY_LENGTH_MINUTES) + 1,
      hour,
      minute: minuteOfDay % MINUTES_PER_HOUR,
      phase: WorldClock.phaseForHour(hour),
    };
  }

  /** Phase an in-game hour belongs to. */
  static phaseForHour(hour: number): DayPhase {
    if (hour >= PHASE_START_HOURS.night || hour < PHASE_START_HOURS.dawn) {
      return "night";
    }
    if (hour < PHASE_START_HOURS.day) return "dawn";
    if (hour < PHASE_START_HOURS.dusk) return "day";
    return "dusk";
  }
}

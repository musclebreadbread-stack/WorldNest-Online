/**
 * Seasons derived from the world clock (decision D16).
 *
 * `seasonForDay(day)` is a pure function of the day counter, so every client
 * sees the same season at the same moment with no coordination.
 */
import { DAYS_PER_SEASON } from "@worldnest/shared";

export enum Season {
  SPRING = 0,
  SUMMER = 1,
  AUTUMN = 2,
  WINTER = 3,
}

export interface SeasonDefinition {
  temperatureShift: number;
}

export const SEASON_DEFINITIONS: Record<Season, SeasonDefinition> = {
  [Season.SPRING]: { temperatureShift: 0 },
  [Season.SUMMER]: { temperatureShift: 10 },
  [Season.AUTUMN]: { temperatureShift: -5 },
  [Season.WINTER]: { temperatureShift: -15 },
};

const SEASON_COUNT = 4;
const CYCLE_LENGTH = DAYS_PER_SEASON * SEASON_COUNT;

/** Which season a game day belongs to. Day 1 starts in spring. */
export function seasonForDay(day: number): Season {
  const dayIndex = ((day - 1) % CYCLE_LENGTH + CYCLE_LENGTH) % CYCLE_LENGTH;
  return Math.floor(dayIndex / DAYS_PER_SEASON) as Season;
}

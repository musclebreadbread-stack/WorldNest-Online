/**
 * Weather derived from the world clock, biome and season (decision D16).
 *
 * `weatherAt(periodIndex, biome, season, phase)` is a pure function: no state
 * is stored, nothing is broadcast, and two clients standing together always
 * see the same sky.
 */
import { WEATHER_PERIOD_MINUTES, WORLD_SEED } from "@worldnest/shared";
import { Biome } from "./Biomes";
import { Season } from "./Seasons";
import type { DayPhase } from "./WorldClock";

export type WeatherKind =
  | "clear"
  | "rain"
  | "snow"
  | "fog"
  | "storm"
  | "rainbow"
  | "aurora"
  | "wind";

/** All valid weather kinds as an array for iteration. */
export const WEATHER_KINDS: readonly WeatherKind[] = [
  "clear",
  "rain",
  "snow",
  "fog",
  "storm",
  "rainbow",
  "aurora",
  "wind",
];

/** Biomes considered cold (snow can fall). */
const COLD_BIOMES: ReadonlySet<Biome> = new Set([Biome.TUNDRA, Biome.TAIGA]);

/** Biomes considered hot (never snow outside winter). */
const HOT_BIOMES: ReadonlySet<Biome> = new Set([Biome.DESERT, Biome.SAVANNA]);

/** Weather period index for a given total game minutes. */
export function weatherPeriodIndex(totalMinutes: number): number {
  return Math.floor(totalMinutes / WEATHER_PERIOD_MINUTES);
}

/**
 * Simple deterministic hash combining period, biome, season and world seed.
 * Produces a value in [0, 1).
 */
function hashWeather(periodIndex: number, biome: Biome, season: Season): number {
  let h = WORLD_SEED ^ (periodIndex * 2654435761);
  h = ((h ^ (biome * 374761393)) >>> 0) * 2246822519;
  h = ((h ^ (season * 668265263)) >>> 0) * 2654435761;
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0x7fffffff) / 0x7fffffff;
}

/**
 * Weather for a given period, biome, season and time-of-day phase.
 *
 * Climate rules (all pure conditions):
 * - Snow: only in cold biomes, or in winter
 * - Aurora: only at night in cold biomes
 * - Rainbow: only in daylight, and only in the period following rain
 * - Storm: never at the same time as fog
 */
export function weatherAt(
  periodIndex: number,
  biome: Biome,
  season: Season,
  phase: DayPhase,
): WeatherKind {
  const h = hashWeather(periodIndex, biome, season);

  // Determine base weather from hash
  const isCold = COLD_BIOMES.has(biome);
  const isHot = HOT_BIOMES.has(biome);
  const isWinter = season === Season.WINTER;
  const isNight = phase === "night";
  const isDaylight = phase === "day" || phase === "dawn";

  // Check if previous period was rain (for rainbow)
  const prevH = hashWeather(periodIndex - 1, biome, season);
  const prevWasRain = prevH >= 0.3 && prevH < 0.55;

  // Aurora: only at night in cold biomes, rare
  if (isNight && isCold && h < 0.08) return "aurora";

  // Rainbow: only in daylight following rain
  if (isDaylight && prevWasRain && h < 0.2) return "rainbow";

  // Snow: only cold biomes or winter
  if ((isCold || isWinter) && !isHot && h >= 0.15 && h < 0.3) return "snow";

  // Rain: common in non-desert biomes
  if (!isHot && h >= 0.3 && h < 0.55) return "rain";

  // Fog: early morning and dusk, never with storm
  if ((phase === "dawn" || phase === "dusk") && h >= 0.55 && h < 0.65) return "fog";

  // Storm: not with fog, more common in certain seasons
  if (h >= 0.65 && h < 0.72 && season !== Season.WINTER) return "storm";

  // Wind: occasional
  if (h >= 0.72 && h < 0.8) return "wind";

  return "clear";
}

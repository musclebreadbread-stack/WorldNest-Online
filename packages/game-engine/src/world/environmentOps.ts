/**
 * Pure environment derivation (decisions D16, D17).
 *
 * `deriveEnvironment(snapshot, biome)` produces a complete environment state
 * from the clock and the biome. The multiplier is bounded to [0.5, 1.5] and
 * never touches health.
 */
import { Biome } from "./Biomes";
import { Season, SEASON_DEFINITIONS, seasonForDay } from "./Seasons";
import { weatherAt, weatherPeriodIndex, type WeatherKind } from "./Weather";
import type { ClockSnapshot, DayPhase } from "./WorldClock";

export interface EnvironmentState {
  season: Season;
  weather: WeatherKind;
  biome: Biome;
  temperature: number;
  energyRegenMultiplier: number;
}

/**
 * Base temperature for each biome, in abstract units.
 * Cold biomes are negative, hot biomes are positive.
 */
const BIOME_BASE_TEMP: Record<Biome, number> = {
  [Biome.TUNDRA]: -20,
  [Biome.TAIGA]: -10,
  [Biome.GRASSLAND]: 15,
  [Biome.FOREST]: 10,
  [Biome.SAVANNA]: 25,
  [Biome.DESERT]: 35,
};

/** Phase-of-day temperature shift. */
const PHASE_TEMP_SHIFT: Record<DayPhase, number> = {
  dawn: -5,
  day: 5,
  dusk: -2,
  night: -10,
};

/**
 * Derive the full environment state from a clock snapshot and the player's
 * current biome. This is a pure function: no side effects, no stored state.
 */
export function deriveEnvironment(
  snapshot: ClockSnapshot,
  biome: Biome,
): EnvironmentState {
  const season = seasonForDay(snapshot.day);
  const periodIdx = weatherPeriodIndex(snapshot.totalMinutes);
  const weather = weatherAt(periodIdx, biome, season, snapshot.phase);

  const seasonDef = SEASON_DEFINITIONS[season];
  const temperature =
    BIOME_BASE_TEMP[biome] +
    seasonDef.temperatureShift +
    PHASE_TEMP_SHIFT[snapshot.phase];

  const energyRegenMultiplier = computeEnergyMultiplier(temperature, weather);

  return { season, weather, biome, temperature, energyRegenMultiplier };
}

/**
 * Energy regeneration multiplier bounded to [0.5, 1.5].
 * Cold/harsh weather slows regen; mild/clear weather speeds it.
 * Never negative, never touches health (decision D17).
 */
function computeEnergyMultiplier(temperature: number, weather: WeatherKind): number {
  let mult = 1.0;

  // Temperature influence: cold slows, warm helps (mildly)
  if (temperature < 0) {
    mult -= Math.min(0.3, Math.abs(temperature) * 0.01);
  } else if (temperature > 10 && temperature < 30) {
    mult += Math.min(0.2, (temperature - 10) * 0.01);
  } else if (temperature >= 30) {
    // Extreme heat also slows
    mult -= Math.min(0.2, (temperature - 30) * 0.01);
  }

  // Weather influence
  switch (weather) {
    case "rain":
      mult -= 0.1;
      break;
    case "storm":
      mult -= 0.15;
      break;
    case "snow":
      mult -= 0.1;
      break;
    case "fog":
      mult -= 0.05;
      break;
    case "wind":
      mult -= 0.05;
      break;
    case "clear":
      mult += 0.1;
      break;
    case "rainbow":
      mult += 0.15;
      break;
    case "aurora":
      mult += 0.05;
      break;
  }

  // Clamp to [0.5, 1.5]
  return Math.max(0.5, Math.min(1.5, mult));
}

/**
 * Static data for the Weather-Enhanced Gathering system.
 *
 * Defines weather-exclusive items and their availability by weather type.
 * Each item can only be gathered during specific weather conditions,
 * making them rare and premium-valued collectibles.
 */

import type { ItemId } from "@worldnest/shared";
import type { WeatherKind } from "../world/Weather";

export interface WeatherGatherItem {
  /** Item identifier from the shared catalogue. */
  itemId: ItemId;
  /** Weather condition required to gather this item. */
  requiredWeather: WeatherKind;
  /** Rarity tier: higher = rarer and more valuable. */
  rarity: number;
  /** Optional biome bonus multiplier for gather chance. */
  biomeBonus: number;
}

/** All weather-exclusive gatherable items. */
export const WEATHER_GATHER_ITEMS: readonly WeatherGatherItem[] = [
  {
    itemId: "rain_mushroom",
    requiredWeather: "rain",
    rarity: 1,
    biomeBonus: 1.2,
  },
  {
    itemId: "snow_crystal",
    requiredWeather: "snow",
    rarity: 2,
    biomeBonus: 1.3,
  },
  {
    itemId: "storm_fossil",
    requiredWeather: "storm",
    rarity: 3,
    biomeBonus: 1.5,
  },
  {
    itemId: "wind_feather",
    requiredWeather: "wind",
    rarity: 2,
    biomeBonus: 1.2,
  },
  {
    itemId: "aurora_gem",
    requiredWeather: "aurora",
    rarity: 4,
    biomeBonus: 1.8,
  },
];

/**
 * Maps each weather kind to the items available during that weather.
 * Weather kinds that have no exclusive items map to an empty array.
 */
export const WEATHER_GATHER_TABLE: Readonly<
  Record<WeatherKind, readonly WeatherGatherItem[]>
> = {
  clear: [],
  rain: WEATHER_GATHER_ITEMS.filter((i) => i.requiredWeather === "rain"),
  snow: WEATHER_GATHER_ITEMS.filter((i) => i.requiredWeather === "snow"),
  fog: [],
  storm: WEATHER_GATHER_ITEMS.filter((i) => i.requiredWeather === "storm"),
  rainbow: [],
  aurora: WEATHER_GATHER_ITEMS.filter((i) => i.requiredWeather === "aurora"),
  wind: WEATHER_GATHER_ITEMS.filter((i) => i.requiredWeather === "wind"),
};

/** Base gather chance percentages per rarity tier (0-1). */
export const WEATHER_GATHER_CHANCE: Readonly<Record<number, number>> = {
  1: 0.4,
  2: 0.25,
  3: 0.15,
  4: 0.08,
};

/** Cooldown in milliseconds between gather attempts. */
export const WEATHER_GATHER_COOLDOWN_MS = 30_000;

/** All 5 weather-exclusive item ids for achievement tracking. */
export const WEATHER_EXCLUSIVE_ITEM_IDS: readonly ItemId[] = WEATHER_GATHER_ITEMS.map(
  (i) => i.itemId,
);

/**
 * Pure functions for the Weather-Enhanced Gathering system.
 *
 * Follows the ops-separate-from-system pattern. All functions are
 * side-effect-free and testable without an ECS world.
 */

import type { ItemId } from "@worldnest/shared";
import type { WeatherKind } from "../world/Weather";
import {
  MAX_WEATHER_NOTIFICATIONS,
  WEATHER_EXCLUSIVE_ITEM_IDS,
  WEATHER_GATHER_CHANCE,
  WEATHER_GATHER_COOLDOWN_MS,
  WEATHER_GATHER_TABLE,
  type WeatherGatherItem,
} from "./weatherGatheringDefinitions";

/** Notification pushed when weather changes to a gatherable type. */
export interface WeatherNotification {
  weather: WeatherKind;
  availableItems: readonly ItemId[];
  timestamp: number;
}

/** Minimal state shape the weather gathering ops need. */
export interface WeatherGatheringState {
  gatheredItems: Map<ItemId, number>;
  weatherNotifications: WeatherNotification[];
  lastGatherTime: number;
  currentWeatherDuration: number;
  version: number;
}

/**
 * Whether the player can attempt a weather gather right now.
 * Requires matching weather and cooldown expired.
 */
export function canGatherWeatherItem(
  weather: WeatherKind | null,
  lastGatherTime: number,
  now: number,
): boolean {
  if (!weather) return false;
  const available = WEATHER_GATHER_TABLE[weather];
  if (available.length === 0) return false;
  return now - lastGatherTime >= WEATHER_GATHER_COOLDOWN_MS;
}

/**
 * Deterministic gather roll based on a provided random value (0-1).
 * Returns the gathered item or null if the roll fails.
 *
 * Uses cumulative probability: each item occupies a slice of [0, 1).
 * This avoids bias when multiple items share the same weather type.
 */
export function rollWeatherGather(
  weather: WeatherKind,
  roll: number,
): WeatherGatherItem | null {
  const available = WEATHER_GATHER_TABLE[weather];
  if (available.length === 0) return null;

  let cumulative = 0;
  for (const item of available) {
    const chance = WEATHER_GATHER_CHANCE[item.rarity] ?? 0.1;
    cumulative += chance;
    if (roll < cumulative) return item;
  }
  return null;
}

/**
 * Returns all items available for gathering during the current weather.
 */
export function getAvailableWeatherItems(
  weather: WeatherKind | null,
): readonly WeatherGatherItem[] {
  if (!weather) return [];
  return WEATHER_GATHER_TABLE[weather];
}

/**
 * Calculate the bonus value multiplier for a gathered weather item
 * based on its rarity and how long the weather has persisted.
 * Longer weather duration gives a slight bonus (capped at 2x).
 */
export function calculateWeatherItemValue(
  rarity: number,
  weatherDurationMs: number,
): number {
  const durationBonus = Math.min(2, 1 + weatherDurationMs / 300_000);
  return rarity * durationBonus;
}

/**
 * Record a gathered weather item in the state.
 */
export function recordWeatherGather(
  state: WeatherGatheringState,
  itemId: ItemId,
  now: number,
): void {
  const current = state.gatheredItems.get(itemId) ?? 0;
  state.gatheredItems.set(itemId, current + 1);
  state.lastGatherTime = now;
  state.version++;
}

/**
 * Push a weather notification when weather changes to a gatherable type.
 * Returns true if a notification was pushed.
 * Trims oldest entries when the notification queue exceeds the cap.
 */
export function pushWeatherNotification(
  state: WeatherGatheringState,
  weather: WeatherKind,
  now: number,
): boolean {
  const available = WEATHER_GATHER_TABLE[weather];
  if (available.length === 0) return false;
  state.weatherNotifications.push({
    weather,
    availableItems: available.map((i) => i.itemId),
    timestamp: now,
  });
  if (state.weatherNotifications.length > MAX_WEATHER_NOTIFICATIONS) {
    state.weatherNotifications.splice(
      0,
      state.weatherNotifications.length - MAX_WEATHER_NOTIFICATIONS,
    );
  }
  state.version++;
  return true;
}

/**
 * Count total weather items gathered across all types.
 */
export function getTotalWeatherItemsGathered(state: WeatherGatheringState): number {
  let total = 0;
  for (const count of state.gatheredItems.values()) {
    total += count;
  }
  return total;
}

/**
 * Count distinct weather-exclusive item types gathered.
 */
export function getDistinctWeatherTypesGathered(state: WeatherGatheringState): number {
  let count = 0;
  for (const itemId of WEATHER_EXCLUSIVE_ITEM_IDS) {
    if ((state.gatheredItems.get(itemId) ?? 0) > 0) {
      count++;
    }
  }
  return count;
}

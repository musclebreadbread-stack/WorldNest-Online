/**
 * Mission definitions: rotating daily and weekly objectives with streak bonuses.
 *
 * Every player-visible string is an i18n key (decision D8). Missions rotate
 * deterministically so that every player on the same day sees the same mission.
 */

import type { ItemId } from "@worldnest/shared";

/** Tagged union for mission objectives. */
export type MissionObjective =
  | { kind: "collect"; itemId: ItemId; count: number }
  | { kind: "fish"; count: number }
  | { kind: "donate"; count: number }
  | { kind: "cook"; count: number }
  | { kind: "explore_tiles"; count: number }
  | { kind: "talk_npc"; count: number };

/** Whether the mission refreshes daily or weekly. */
export type MissionTier = "DAILY" | "WEEKLY";

export interface MissionDefinition {
  id: string;
  titleKey: string;
  descriptionKey: string;
  tier: MissionTier;
  objective: MissionObjective;
  baseRewardCoins: number;
}

/** The 8 daily missions that rotate deterministically. */
export const DAILY_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "daily_gather_wood",
    titleKey: "mission.daily_gather_wood.title",
    descriptionKey: "mission.daily_gather_wood.description",
    tier: "DAILY",
    objective: { kind: "collect", itemId: "wood", count: 5 },
    baseRewardCoins: 15,
  },
  {
    id: "daily_gather_stone",
    titleKey: "mission.daily_gather_stone.title",
    descriptionKey: "mission.daily_gather_stone.description",
    tier: "DAILY",
    objective: { kind: "collect", itemId: "stone", count: 3 },
    baseRewardCoins: 15,
  },
  {
    id: "daily_fish",
    titleKey: "mission.daily_fish.title",
    descriptionKey: "mission.daily_fish.description",
    tier: "DAILY",
    objective: { kind: "fish", count: 2 },
    baseRewardCoins: 20,
  },
  {
    id: "daily_donate",
    titleKey: "mission.daily_donate.title",
    descriptionKey: "mission.daily_donate.description",
    tier: "DAILY",
    objective: { kind: "donate", count: 1 },
    baseRewardCoins: 20,
  },
  {
    id: "daily_cook",
    titleKey: "mission.daily_cook.title",
    descriptionKey: "mission.daily_cook.description",
    tier: "DAILY",
    objective: { kind: "cook", count: 1 },
    baseRewardCoins: 20,
  },
  {
    id: "daily_explore",
    titleKey: "mission.daily_explore.title",
    descriptionKey: "mission.daily_explore.description",
    tier: "DAILY",
    objective: { kind: "explore_tiles", count: 10 },
    baseRewardCoins: 15,
  },
  {
    id: "daily_talk",
    titleKey: "mission.daily_talk.title",
    descriptionKey: "mission.daily_talk.description",
    tier: "DAILY",
    objective: { kind: "talk_npc", count: 2 },
    baseRewardCoins: 10,
  },
  {
    id: "daily_harvest_wheat",
    titleKey: "mission.daily_harvest_wheat.title",
    descriptionKey: "mission.daily_harvest_wheat.description",
    tier: "DAILY",
    objective: { kind: "collect", itemId: "wheat", count: 3 },
    baseRewardCoins: 15,
  },
];

/** The 4 weekly missions that rotate deterministically. */
export const WEEKLY_MISSIONS: readonly MissionDefinition[] = [
  {
    id: "weekly_fish_master",
    titleKey: "mission.weekly_fish_master.title",
    descriptionKey: "mission.weekly_fish_master.description",
    tier: "WEEKLY",
    objective: { kind: "fish", count: 10 },
    baseRewardCoins: 80,
  },
  {
    id: "weekly_explorer",
    titleKey: "mission.weekly_explorer.title",
    descriptionKey: "mission.weekly_explorer.description",
    tier: "WEEKLY",
    objective: { kind: "explore_tiles", count: 50 },
    baseRewardCoins: 75,
  },
  {
    id: "weekly_cook_feast",
    titleKey: "mission.weekly_cook_feast.title",
    descriptionKey: "mission.weekly_cook_feast.description",
    tier: "WEEKLY",
    objective: { kind: "cook", count: 5 },
    baseRewardCoins: 70,
  },
  {
    id: "weekly_social",
    titleKey: "mission.weekly_social.title",
    descriptionKey: "mission.weekly_social.description",
    tier: "WEEKLY",
    objective: { kind: "talk_npc", count: 8 },
    baseRewardCoins: 60,
  },
];

/**
 * Streak multipliers for consecutive daily completions.
 * Index 0 = no streak, 1 = 1-day streak, 2 = 2-day streak, 3+ = 3+ days.
 */
export const STREAK_BONUS_MULTIPLIERS: readonly number[] = [1.0, 1.25, 1.5, 2.0];

/** All mission definitions combined. */
const ALL_MISSIONS: Record<string, MissionDefinition> = {};
for (const m of [...DAILY_MISSIONS, ...WEEKLY_MISSIONS]) {
  ALL_MISSIONS[m.id] = m;
}

/** Look up a mission definition by id. */
export function getMission(id: string): MissionDefinition | undefined {
  return ALL_MISSIONS[id];
}

/** Deterministic daily mission rotation based on day number. */
export function getDailyMissionForDay(day: number): MissionDefinition {
  const index =
    ((day % DAILY_MISSIONS.length) + DAILY_MISSIONS.length) % DAILY_MISSIONS.length;
  return DAILY_MISSIONS[index];
}

/** Deterministic weekly mission rotation based on week number. */
export function getWeeklyMissionForWeek(week: number): MissionDefinition {
  const index =
    ((week % WEEKLY_MISSIONS.length) + WEEKLY_MISSIONS.length) % WEEKLY_MISSIONS.length;
  return WEEKLY_MISSIONS[index];
}

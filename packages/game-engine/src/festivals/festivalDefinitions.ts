/**
 * Festival definitions for the seasonal event system.
 *
 * Each festival is tied to a specific season and day-of-season (1-based).
 * The `dayOfSeason` marks the first day the festival is active.
 * The `durationDays` controls how many consecutive days the festival lasts.
 */
import { Season } from "../world/Seasons";

export interface FestivalDefinition {
  id: string;
  titleKey: string;
  descriptionKey: string;
  season: Season;
  /** 1-based day within the season the festival starts on. */
  dayOfSeason: number;
  durationDays: number;
  rewardCoins: number;
}

export const FESTIVAL_DEFINITIONS: readonly FestivalDefinition[] = [
  {
    id: "blossom_fest",
    titleKey: "festival.blossom_fest.title",
    descriptionKey: "festival.blossom_fest.description",
    season: Season.SPRING,
    dayOfSeason: 3,
    durationDays: 2,
    rewardCoins: 40,
  },
  {
    id: "harvest_moon",
    titleKey: "festival.harvest_moon.title",
    descriptionKey: "festival.harvest_moon.description",
    season: Season.SUMMER,
    dayOfSeason: 5,
    durationDays: 2,
    rewardCoins: 50,
  },
  {
    id: "mushroom_fair",
    titleKey: "festival.mushroom_fair.title",
    descriptionKey: "festival.mushroom_fair.description",
    season: Season.AUTUMN,
    dayOfSeason: 2,
    durationDays: 2,
    rewardCoins: 35,
  },
  {
    id: "starlight_night",
    titleKey: "festival.starlight_night.title",
    descriptionKey: "festival.starlight_night.description",
    season: Season.WINTER,
    dayOfSeason: 6,
    durationDays: 1,
    rewardCoins: 60,
  },
] as const;

export const FESTIVAL_IDS = FESTIVAL_DEFINITIONS.map((d) => d.id);

export function getFestival(id: string): FestivalDefinition | undefined {
  return FESTIVAL_DEFINITIONS.find((d) => d.id === id);
}

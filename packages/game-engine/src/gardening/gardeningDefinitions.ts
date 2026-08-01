/**
 * Static data for the Gardening and Flower Arrangement system.
 *
 * Defines flower varieties, arrangement scoring rules, and competition tiers.
 * Every player-visible string is an i18n key (decision D8).
 */

export enum FlowerVariety {
  ROSE = "rose",
  LILY = "lily",
  TULIP = "tulip",
  SUNFLOWER = "sunflower",
}

export const FLOWER_VARIETIES: readonly FlowerVariety[] = [
  FlowerVariety.ROSE,
  FlowerVariety.LILY,
  FlowerVariety.TULIP,
  FlowerVariety.SUNFLOWER,
];

/** Beauty points awarded per flower variety in an arrangement. */
export const FLOWER_BEAUTY_POINTS: Readonly<Record<FlowerVariety, number>> = {
  [FlowerVariety.ROSE]: 10,
  [FlowerVariety.LILY]: 8,
  [FlowerVariety.TULIP]: 7,
  [FlowerVariety.SUNFLOWER]: 12,
};

/** Bonus multiplier for including multiple distinct varieties. */
export const VARIETY_BONUS_MULTIPLIER = 1.5;

/** Bonus multiplier when all flowers in an arrangement match the season. */
export const SEASONAL_BONUS_MULTIPLIER = 1.25;

export enum CompetitionTier {
  BRONZE = "bronze",
  SILVER = "silver",
  GOLD = "gold",
}

/** Minimum score thresholds for each competition tier. */
export const COMPETITION_THRESHOLDS: Readonly<Record<CompetitionTier, number>> = {
  [CompetitionTier.BRONZE]: 20,
  [CompetitionTier.SILVER]: 40,
  [CompetitionTier.GOLD]: 60,
};

/** Coin rewards for each competition tier. */
export const COMPETITION_REWARDS: Readonly<Record<CompetitionTier, number>> = {
  [CompetitionTier.BRONZE]: 15,
  [CompetitionTier.SILVER]: 30,
  [CompetitionTier.GOLD]: 50,
};

/** Growth time in milliseconds before a planted flower can be harvested. */
export const FLOWER_GROWTH_TIME_MS = 60_000;

/** Water level depletes over time; this is the max. */
export const MAX_WATER_LEVEL = 100;

/** Water restored per watering action. */
export const WATER_PER_ACTION = 25;

/** Flowers required for an arrangement. */
export const ARRANGEMENT_FLOWER_COUNT = 3;

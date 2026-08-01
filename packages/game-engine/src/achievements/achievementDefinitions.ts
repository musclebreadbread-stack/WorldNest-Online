/**
 * Achievement definitions for the horizontal progression badge system.
 *
 * Each achievement has a condition (polled or threshold-based) and a coin reward.
 * Conditions are a tagged union so the system can evaluate them generically.
 * Every player-visible string is an i18n key (decision D8).
 */

export type AchievementCondition =
  | { kind: "collect"; itemId: string; count: number }
  | { kind: "donate"; count: number }
  | { kind: "build"; count: number }
  | { kind: "quest"; count: number }
  | { kind: "fish"; count: number }
  | { kind: "total_coins"; amount: number }
  | { kind: "category_complete"; categoryId: string; donateCount: number }
  | { kind: "tame"; count: number }
  | { kind: "quiz_streak"; count: number }
  | { kind: "housing_happiness"; threshold: number }
  | { kind: "craft"; count: number }
  | { kind: "rhythm_perfect"; count: number }
  | { kind: "rhythm_score"; score: number }
  | { kind: "mount_bond"; level: number }
  | { kind: "water_travel"; tiles: number }
  | { kind: "friendship_level"; level: number }
  | { kind: "total_gifts"; count: number }
  | { kind: "biomes_discovered"; count: number }
  | { kind: "landmarks_discovered"; count: number }
  | { kind: "map_completion"; percent: number };

export interface AchievementDefinition {
  id: string;
  titleKey: string;
  descriptionKey: string;
  rewardCoins: number;
  condition: AchievementCondition;
}

/**
 * Source interface for achievement condition evaluation.
 * Provides polled counters from the entity state.
 */
export interface AchievementSource {
  itemCount: (itemId: string) => number;
  donationCount: number;
  structureCount: number;
  questCompletionCount: number;
  fishCaughtCount: number;
  totalCoinsEarned: number;
  animalsTamedCount: number;
  quizStreak: number;
  housingHappiness: number;
  craftCount: number;
  rhythmPerfectCount: number;
  rhythmScore: number;
  mountBondLevel: number;
  waterTilesTraversed: number;
  highestFriendshipLevel: number;
  totalGiftsGiven: number;
  biomesDiscovered: number;
  landmarksDiscovered: number;
  mapCompletionPercent: number;
  isCategoryComplete: (categoryId: string) => boolean;
}

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    id: "first_harvest",
    titleKey: "achievement.first_harvest.title",
    descriptionKey: "achievement.first_harvest.description",
    rewardCoins: 10,
    condition: { kind: "collect", itemId: "wheat", count: 1 },
  },
  {
    id: "first_fish",
    titleKey: "achievement.first_fish.title",
    descriptionKey: "achievement.first_fish.description",
    rewardCoins: 10,
    condition: { kind: "fish", count: 1 },
  },
  {
    id: "collector_5",
    titleKey: "achievement.collector_5.title",
    descriptionKey: "achievement.collector_5.description",
    rewardCoins: 25,
    condition: { kind: "donate", count: 5 },
  },
  {
    id: "builder_10",
    titleKey: "achievement.builder_10.title",
    descriptionKey: "achievement.builder_10.description",
    rewardCoins: 30,
    condition: { kind: "build", count: 10 },
  },
  {
    id: "quest_master",
    titleKey: "achievement.quest_master.title",
    descriptionKey: "achievement.quest_master.description",
    rewardCoins: 50,
    condition: { kind: "quest", count: 3 },
  },
  {
    id: "big_spender",
    titleKey: "achievement.big_spender.title",
    descriptionKey: "achievement.big_spender.description",
    rewardCoins: 40,
    condition: { kind: "total_coins", amount: 200 },
  },
  {
    id: "fish_master",
    titleKey: "achievement.fish_master.title",
    descriptionKey: "achievement.fish_master.description",
    rewardCoins: 35,
    condition: { kind: "fish", count: 10 },
  },
  {
    id: "full_gathering",
    titleKey: "achievement.full_gathering.title",
    descriptionKey: "achievement.full_gathering.description",
    rewardCoins: 60,
    condition: { kind: "category_complete", categoryId: "gathering", donateCount: 5 },
  },
  {
    id: "first_tame",
    titleKey: "achievement.first_tame.title",
    descriptionKey: "achievement.first_tame.description",
    rewardCoins: 20,
    condition: { kind: "tame", count: 1 },
  },
  {
    id: "animal_friend",
    titleKey: "achievement.animal_friend.title",
    descriptionKey: "achievement.animal_friend.description",
    rewardCoins: 50,
    condition: { kind: "tame", count: 3 },
  },
  {
    id: "quiz_streak_3",
    titleKey: "achievement.quiz_streak_3.title",
    descriptionKey: "achievement.quiz_streak_3.description",
    rewardCoins: 30,
    condition: { kind: "quiz_streak", count: 3 },
  },
  {
    id: "homeowner",
    titleKey: "achievement.homeowner.title",
    descriptionKey: "achievement.homeowner.description",
    rewardCoins: 40,
    condition: { kind: "housing_happiness", threshold: 50 },
  },
  {
    id: "first_craft",
    titleKey: "achievement.first_craft.title",
    descriptionKey: "achievement.first_craft.description",
    rewardCoins: 15,
    condition: { kind: "craft", count: 1 },
  },
  {
    id: "tool_master",
    titleKey: "achievement.tool_master.title",
    descriptionKey: "achievement.tool_master.description",
    rewardCoins: 50,
    condition: { kind: "craft", count: 5 },
  },
  {
    id: "first_rhythm",
    titleKey: "achievement.first_rhythm.title",
    descriptionKey: "achievement.first_rhythm.description",
    rewardCoins: 15,
    condition: { kind: "rhythm_perfect", count: 1 },
  },
  {
    id: "rhythm_master",
    titleKey: "achievement.rhythm_master.title",
    descriptionKey: "achievement.rhythm_master.description",
    rewardCoins: 50,
    condition: { kind: "rhythm_score", score: 500 },
  },
  {
    id: "first_ride",
    titleKey: "achievement.first_ride.title",
    descriptionKey: "achievement.first_ride.description",
    rewardCoins: 20,
    condition: { kind: "mount_bond", level: 0 },
  },
  {
    id: "sea_explorer",
    titleKey: "achievement.sea_explorer.title",
    descriptionKey: "achievement.sea_explorer.description",
    rewardCoins: 40,
    condition: { kind: "water_travel", tiles: 100 },
  },
  {
    id: "first_gift",
    titleKey: "achievement.first_gift.title",
    descriptionKey: "achievement.first_gift.description",
    rewardCoins: 10,
    condition: { kind: "total_gifts", count: 1 },
  },
  {
    id: "best_friends",
    titleKey: "achievement.best_friends.title",
    descriptionKey: "achievement.best_friends.description",
    rewardCoins: 75,
    condition: { kind: "friendship_level", level: 4 },
  },
  {
    id: "first_biome",
    titleKey: "achievement.first_biome.title",
    descriptionKey: "achievement.first_biome.description",
    rewardCoins: 15,
    condition: { kind: "biomes_discovered", count: 1 },
  },
  {
    id: "cartographer",
    titleKey: "achievement.cartographer.title",
    descriptionKey: "achievement.cartographer.description",
    rewardCoins: 60,
    condition: { kind: "biomes_discovered", count: 6 },
  },
  {
    id: "landmark_hunter",
    titleKey: "achievement.landmark_hunter.title",
    descriptionKey: "achievement.landmark_hunter.description",
    rewardCoins: 45,
    condition: { kind: "landmarks_discovered", count: 3 },
  },
];

/** All achievement ids in definition order. */
export const ACHIEVEMENT_IDS = ACHIEVEMENT_DEFINITIONS.map((a) => a.id);

/** Look up an achievement definition by id. */
export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((a) => a.id === id);
}

/**
 * Static data for the Village Reputation system.
 *
 * Defines village tiers, contribution point values, community projects,
 * and milestone rewards. Every player-visible string is an i18n key.
 */

/** Village development tiers. */
export enum VillageTier {
  HAMLET = 0,
  VILLAGE = 1,
  TOWN = 2,
  CITY = 3,
  METROPOLIS = 4,
}

/** Point thresholds required to reach each tier. */
export const TIER_THRESHOLDS: Readonly<Record<VillageTier, number>> = {
  [VillageTier.HAMLET]: 0,
  [VillageTier.VILLAGE]: 100,
  [VillageTier.TOWN]: 300,
  [VillageTier.CITY]: 600,
  [VillageTier.METROPOLIS]: 1000,
};

/** Actions that contribute reputation points. */
export type ContributionAction =
  | "quest_complete"
  | "donation"
  | "gift_given"
  | "structure_placed"
  | "competition_won"
  | "weather_item_gathered";

/** Points awarded per action type. */
export const CONTRIBUTION_POINTS: Readonly<Record<ContributionAction, number>> = {
  quest_complete: 10,
  donation: 5,
  gift_given: 3,
  structure_placed: 8,
  competition_won: 15,
  weather_item_gathered: 2,
};

/** i18n key for each tier name. */
export const TIER_NAME_KEYS: Readonly<Record<VillageTier, string>> = {
  [VillageTier.HAMLET]: "reputation.tier.hamlet",
  [VillageTier.VILLAGE]: "reputation.tier.village",
  [VillageTier.TOWN]: "reputation.tier.town",
  [VillageTier.CITY]: "reputation.tier.city",
  [VillageTier.METROPOLIS]: "reputation.tier.metropolis",
};

/** Coins awarded at each tier transition. */
export const TIER_MILESTONE_REWARDS: Readonly<Record<VillageTier, number>> = {
  [VillageTier.HAMLET]: 0,
  [VillageTier.VILLAGE]: 50,
  [VillageTier.TOWN]: 100,
  [VillageTier.CITY]: 200,
  [VillageTier.METROPOLIS]: 500,
};

/** A community project that unlocks when a tier is reached. */
export interface CommunityProject {
  id: string;
  nameKey: string;
  descriptionKey: string;
  /** Tier required to start this project. */
  requiredTier: VillageTier;
  /** Total contribution points needed to complete the project. */
  requiredPoints: number;
  /** What this project unlocks upon completion. */
  unlockKey: string;
}

/** One community project per tier upgrade (tiers 1-4 + a metropolis bonus). */
export const COMMUNITY_PROJECTS: readonly CommunityProject[] = [
  {
    id: "village_well",
    nameKey: "reputation.project.village_well.name",
    descriptionKey: "reputation.project.village_well.description",
    requiredTier: VillageTier.VILLAGE,
    requiredPoints: 50,
    unlockKey: "reputation.project.village_well.unlock",
  },
  {
    id: "town_market",
    nameKey: "reputation.project.town_market.name",
    descriptionKey: "reputation.project.town_market.description",
    requiredTier: VillageTier.TOWN,
    requiredPoints: 100,
    unlockKey: "reputation.project.town_market.unlock",
  },
  {
    id: "city_library",
    nameKey: "reputation.project.city_library.name",
    descriptionKey: "reputation.project.city_library.description",
    requiredTier: VillageTier.CITY,
    requiredPoints: 150,
    unlockKey: "reputation.project.city_library.unlock",
  },
  {
    id: "metropolis_plaza",
    nameKey: "reputation.project.metropolis_plaza.name",
    descriptionKey: "reputation.project.metropolis_plaza.description",
    requiredTier: VillageTier.METROPOLIS,
    requiredPoints: 200,
    unlockKey: "reputation.project.metropolis_plaza.unlock",
  },
  {
    id: "grand_monument",
    nameKey: "reputation.project.grand_monument.name",
    descriptionKey: "reputation.project.grand_monument.description",
    requiredTier: VillageTier.METROPOLIS,
    requiredPoints: 300,
    unlockKey: "reputation.project.grand_monument.unlock",
  },
];

/** All community project ids in definition order. */
export const COMMUNITY_PROJECT_IDS = COMMUNITY_PROJECTS.map((p) => p.id);

/** Look up a community project by id. */
export function getCommunityProject(id: string): CommunityProject | undefined {
  return COMMUNITY_PROJECTS.find((p) => p.id === id);
}

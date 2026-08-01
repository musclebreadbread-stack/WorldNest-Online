/**
 * Static data for the Exploration Log system.
 *
 * Defines landmarks (one per biome) and biome discovery rewards.
 * Every player-visible string is an i18n key (decision D8).
 */

import { Biome } from "../world/Biomes";

export interface LandmarkDefinition {
  id: string;
  nameKey: string;
  descriptionKey: string;
  biome: Biome;
  tileX: number;
  tileY: number;
  rewardCoins: number;
}

/** One landmark per biome. */
export const LANDMARK_DEFINITIONS: readonly LandmarkDefinition[] = [
  {
    id: "tundra_peak",
    nameKey: "landmark.tundra_peak.name",
    descriptionKey: "landmark.tundra_peak.description",
    biome: Biome.TUNDRA,
    tileX: 50,
    tileY: 12,
    rewardCoins: 20,
  },
  {
    id: "taiga_grove",
    nameKey: "landmark.taiga_grove.name",
    descriptionKey: "landmark.taiga_grove.description",
    biome: Biome.TAIGA,
    tileX: 80,
    tileY: 45,
    rewardCoins: 20,
  },
  {
    id: "meadow_spring",
    nameKey: "landmark.meadow_spring.name",
    descriptionKey: "landmark.meadow_spring.description",
    biome: Biome.GRASSLAND,
    tileX: 30,
    tileY: 60,
    rewardCoins: 20,
  },
  {
    id: "ancient_forest",
    nameKey: "landmark.ancient_forest.name",
    descriptionKey: "landmark.ancient_forest.description",
    biome: Biome.FOREST,
    tileX: 100,
    tileY: 75,
    rewardCoins: 20,
  },
  {
    id: "savanna_oasis",
    nameKey: "landmark.savanna_oasis.name",
    descriptionKey: "landmark.savanna_oasis.description",
    biome: Biome.SAVANNA,
    tileX: 120,
    tileY: 90,
    rewardCoins: 20,
  },
  {
    id: "desert_shrine",
    nameKey: "landmark.desert_shrine.name",
    descriptionKey: "landmark.desert_shrine.description",
    biome: Biome.DESERT,
    tileX: 150,
    tileY: 110,
    rewardCoins: 20,
  },
];

/** Coins awarded for each new biome discovered. */
export const BIOME_DISCOVERY_REWARDS: Readonly<Record<Biome, number>> = {
  [Biome.TUNDRA]: 10,
  [Biome.TAIGA]: 10,
  [Biome.GRASSLAND]: 10,
  [Biome.FOREST]: 10,
  [Biome.SAVANNA]: 10,
  [Biome.DESERT]: 10,
};

/** All landmark ids in definition order. */
export const LANDMARK_IDS = LANDMARK_DEFINITIONS.map((l) => l.id);

/** Look up a landmark definition by id. */
export function getLandmark(id: string): LandmarkDefinition | undefined {
  return LANDMARK_DEFINITIONS.find((l) => l.id === id);
}

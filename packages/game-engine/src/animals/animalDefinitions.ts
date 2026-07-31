/**
 * Animal species catalogue.
 *
 * Each species has a set of biomes it can spawn in, a taming threshold
 * (how many times a player must feed it before it becomes tame), a movement
 * speed, and a flee distance. All player-visible strings are i18n keys
 * (decision D8).
 */
import { Biome } from "../world/Biomes";

export type AnimalSpecies = "rabbit" | "deer" | "fox" | "bird" | "turtle";

export interface AnimalDefinition {
  id: AnimalSpecies;
  nameKey: string;
  biomes: readonly Biome[];
  tamingFeedCount: number;
  speed: number;
  fleeDistance: number;
  textureKey: string;
}

export const ANIMAL_DEFINITIONS: Record<AnimalSpecies, AnimalDefinition> = {
  rabbit: {
    id: "rabbit",
    nameKey: "animal.rabbit",
    biomes: [Biome.GRASSLAND, Biome.FOREST],
    tamingFeedCount: 2,
    speed: 40,
    fleeDistance: 3,
    textureKey: "animal_rabbit",
  },
  deer: {
    id: "deer",
    nameKey: "animal.deer",
    biomes: [Biome.FOREST, Biome.TAIGA],
    tamingFeedCount: 4,
    speed: 50,
    fleeDistance: 5,
    textureKey: "animal_deer",
  },
  fox: {
    id: "fox",
    nameKey: "animal.fox",
    biomes: [Biome.FOREST, Biome.SAVANNA],
    tamingFeedCount: 5,
    speed: 45,
    fleeDistance: 4,
    textureKey: "animal_fox",
  },
  bird: {
    id: "bird",
    nameKey: "animal.bird",
    biomes: [Biome.GRASSLAND, Biome.SAVANNA, Biome.DESERT],
    tamingFeedCount: 3,
    speed: 55,
    fleeDistance: 4,
    textureKey: "animal_bird",
  },
  turtle: {
    id: "turtle",
    nameKey: "animal.turtle",
    biomes: [Biome.GRASSLAND, Biome.SAVANNA],
    tamingFeedCount: 2,
    speed: 15,
    fleeDistance: 2,
    textureKey: "animal_turtle",
  },
};

export const ANIMAL_SPECIES: readonly AnimalSpecies[] = Object.keys(
  ANIMAL_DEFINITIONS,
) as AnimalSpecies[];

/** Look up an animal definition by species id. */
export function getAnimalDefinition(species: AnimalSpecies): AnimalDefinition {
  return ANIMAL_DEFINITIONS[species];
}

export type { AnimalBehavior } from "./animalState";
export {
  ANIMAL_DEFINITIONS,
  ANIMAL_SPECIES,
  getAnimalDefinition,
} from "./animalDefinitions";
export type { AnimalDefinition, AnimalSpecies } from "./animalDefinitions";
export {
  FOLLOW_STOP_DISTANCE,
  IDLE_WANDER_INTERVAL_MS,
  WANDER_RADIUS,
  canTame,
  feedAnimal,
  pickWanderTarget,
  rollSpawnChance,
  shouldFlee,
  tickFlee,
  tickFollow,
  tickIdle,
  tickWander,
} from "./animalOps";

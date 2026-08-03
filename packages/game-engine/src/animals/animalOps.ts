/**
 * Pure animal behavior and taming operations.
 *
 * All functions are side-effect-free and operate on plain data so that the
 * ECS system can call them without coupling logic to the component structure.
 */
import { ANIMAL_DEFINITIONS, type AnimalSpecies } from "./animalDefinitions";
import type { AnimalBehavior } from "./animalState";

/** Whether an animal can be tamed (not yet owned and enough feed given). */
export function canTame(
  speciesId: AnimalSpecies,
  feedCount: number,
  ownerId: string | null,
): boolean {
  if (ownerId !== null) return false;
  const definition = ANIMAL_DEFINITIONS[speciesId];
  return feedCount >= definition.tamingFeedCount;
}

/**
 * Increment feed count and return whether the animal is now tamed.
 * Pure: returns the new feedCount and tamed status without mutation.
 */
export function feedAnimal(
  speciesId: AnimalSpecies,
  currentFeedCount: number,
): { feedCount: number; tamed: boolean } {
  const newCount = currentFeedCount + 1;
  const tamed = newCount >= ANIMAL_DEFINITIONS[speciesId].tamingFeedCount;
  return { feedCount: newCount, tamed };
}

/** Interval in ms between wander target picks while idle. */
export const IDLE_WANDER_INTERVAL_MS = 3000;

/** Maximum wander distance in tiles from the current position. */
export const WANDER_RADIUS = 3;

/**
 * Pick a random wander target around a position.
 * Returns tile coordinates offset from the given origin.
 */
export function pickWanderTarget(
  originX: number,
  originY: number,
  rng: () => number,
): { x: number; y: number } {
  const dx = Math.floor(rng() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS;
  const dy = Math.floor(rng() * (WANDER_RADIUS * 2 + 1)) - WANDER_RADIUS;
  return { x: originX + dx, y: originY + dy };
}

/**
 * Tick the idle behavior. Returns new behavior and updated timer.
 * When the timer exceeds the wander interval, the animal transitions
 * to wander.
 */
export function tickIdle(
  timer: number,
  deltaMs: number,
): { behavior: AnimalBehavior; timer: number } {
  const next = timer + deltaMs;
  if (next >= IDLE_WANDER_INTERVAL_MS) {
    return { behavior: "wander", timer: 0 };
  }
  return { behavior: "idle", timer: next };
}

/**
 * Tick the wander behavior. Returns whether the animal has reached its
 * target (within threshold distance in pixels).
 */
export function tickWander(
  posX: number,
  posY: number,
  targetX: number,
  targetY: number,
  threshold: number,
): boolean {
  const dx = targetX - posX;
  const dy = targetY - posY;
  return Math.abs(dx) <= threshold && Math.abs(dy) <= threshold;
}

/**
 * Check if the animal should flee. Returns true when the player is within
 * the species' flee distance (in tile units).
 */
export function shouldFlee(
  animalTileX: number,
  animalTileY: number,
  playerTileX: number,
  playerTileY: number,
  fleeDistance: number,
): boolean {
  const dx = Math.abs(animalTileX - playerTileX);
  const dy = Math.abs(animalTileY - playerTileY);
  return dx <= fleeDistance && dy <= fleeDistance;
}

/**
 * Tick the flee behavior. Returns the velocity direction away from the
 * threat (normalized to -1, 0, or 1 per axis).
 */
export function tickFlee(
  animalX: number,
  animalY: number,
  threatX: number,
  threatY: number,
): { vx: number; vy: number } {
  const dx = animalX - threatX;
  const dy = animalY - threatY;
  return {
    vx: dx === 0 ? 0 : dx > 0 ? 1 : -1,
    vy: dy === 0 ? 0 : dy > 0 ? 1 : -1,
  };
}

/** Maximum follow distance in pixels before the pet stops moving. */
export const FOLLOW_STOP_DISTANCE = 32;

/**
 * Tick the follow behavior. Returns velocity toward the owner position.
 * When close enough, returns zero velocity.
 */
export function tickFollow(
  animalX: number,
  animalY: number,
  ownerX: number,
  ownerY: number,
): { vx: number; vy: number } {
  const dx = ownerX - animalX;
  const dy = ownerY - animalY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist <= FOLLOW_STOP_DISTANCE) {
    return { vx: 0, vy: 0 };
  }

  return {
    vx: dx === 0 ? 0 : dx > 0 ? 1 : -1,
    vy: dy === 0 ? 0 : dy > 0 ? 1 : -1,
  };
}

/**
 * Roll spawn chance for a biome. Returns the species to spawn, or null
 * if no spawn occurs this tick. Base chance is low per tick.
 */
export function rollSpawnChance(
  biome: number,
  rng: () => number,
  spawnRate: number = 0.005,
): AnimalSpecies | null {
  if (rng() > spawnRate) return null;

  const candidates = Object.values(ANIMAL_DEFINITIONS).filter((def) =>
    def.biomes.includes(biome),
  );
  if (candidates.length === 0) return null;

  const index = Math.floor(rng() * candidates.length);
  return candidates[index].id;
}

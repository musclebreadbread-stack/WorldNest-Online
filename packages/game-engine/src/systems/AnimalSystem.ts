import { System } from "../ecs/System";
import type { Entity } from "../ecs/Entity";
import { AnimalComponent } from "../components/AnimalComponent";
import { PositionComponent } from "../components/PositionComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { ANIMAL_DEFINITIONS, type AnimalSpecies } from "../animals/animalDefinitions";
import {
  pickWanderTarget,
  shouldFlee,
  tickFlee,
  tickFollow,
  tickIdle,
  tickWander,
} from "../animals/animalOps";
import { TILE_SIZE } from "@worldnest/shared";

export type TameListener = () => void;

/**
 * Processes animal entities: idle/wander cycle, flee from nearby players,
 * and follow behavior for tamed pets.
 *
 * Player positions are injected via `setPlayerPosition` each frame before
 * `update` is called, keeping the system decoupled from the player entity.
 */
export class AnimalSystem extends System {
  private playerX = 0;
  private playerY = 0;
  private readonly rng: () => number;
  private readonly onTame: TameListener | undefined;

  constructor(rng?: () => number, onTame?: TameListener) {
    super(["position", "animal", "velocity"]);
    this.rng = rng ?? Math.random;
    this.onTame = onTame;
  }

  /** Call once per frame with the local player's pixel position. */
  setPlayerPosition(x: number, y: number): void {
    this.playerX = x;
    this.playerY = y;
  }

  update(entities: Entity[], deltaTime: number): void {
    const deltaMs = deltaTime * 1000;

    for (const entity of entities) {
      if (!this.matches(entity)) continue;

      const pos = entity.getComponent("position") as PositionComponent;
      const animal = entity.getComponent("animal") as AnimalComponent;
      const vel = entity.getComponent("velocity") as VelocityComponent;
      const def = ANIMAL_DEFINITIONS[animal.speciesId as AnimalSpecies];

      if (animal.ownerId !== null) {
        this.updateTamed(animal, pos, vel, def.speed);
        continue;
      }

      this.updateWild(animal, pos, vel, def, deltaMs);
    }
  }

  private updateTamed(
    animal: AnimalComponent,
    pos: PositionComponent,
    vel: VelocityComponent,
    speed: number,
  ): void {
    const result = tickFollow(pos.x, pos.y, this.playerX, this.playerY);
    vel.vx = result.vx * speed;
    vel.vy = result.vy * speed;
    animal.behavior = result.vx === 0 && result.vy === 0 ? "tamed_idle" : "follow";
  }

  private updateWild(
    animal: AnimalComponent,
    pos: PositionComponent,
    vel: VelocityComponent,
    def: (typeof ANIMAL_DEFINITIONS)[AnimalSpecies],
    deltaMs: number,
  ): void {
    const animalTileX = Math.floor(pos.x / TILE_SIZE);
    const animalTileY = Math.floor(pos.y / TILE_SIZE);
    const playerTileX = Math.floor(this.playerX / TILE_SIZE);
    const playerTileY = Math.floor(this.playerY / TILE_SIZE);

    if (
      shouldFlee(animalTileX, animalTileY, playerTileX, playerTileY, def.fleeDistance)
    ) {
      animal.behavior = "flee";
      const flee = tickFlee(pos.x, pos.y, this.playerX, this.playerY);
      vel.vx = flee.vx * def.speed;
      vel.vy = flee.vy * def.speed;
      animal.fleeTimer += deltaMs;
      animal.version++;
      return;
    }

    if (animal.behavior === "flee") {
      animal.behavior = "idle";
      animal.wanderTimer = 0;
      vel.vx = 0;
      vel.vy = 0;
      animal.version++;
      return;
    }

    if (animal.behavior === "idle") {
      const result = tickIdle(animal.wanderTimer, deltaMs);
      animal.wanderTimer = result.timer;
      if (result.behavior === "wander") {
        animal.behavior = "wander";
        animal.wanderTarget = pickWanderTarget(animalTileX, animalTileY, this.rng);
        animal.version++;
      }
      vel.vx = 0;
      vel.vy = 0;
      return;
    }

    if (animal.behavior === "wander" && animal.wanderTarget) {
      const targetPx = animal.wanderTarget.x * TILE_SIZE + TILE_SIZE / 2;
      const targetPy = animal.wanderTarget.y * TILE_SIZE + TILE_SIZE / 2;
      const reached = tickWander(pos.x, pos.y, targetPx, targetPy, TILE_SIZE / 2);

      if (reached) {
        animal.behavior = "idle";
        animal.wanderTimer = 0;
        animal.wanderTarget = null;
        vel.vx = 0;
        vel.vy = 0;
        animal.version++;
      } else {
        const dx = targetPx - pos.x;
        const dy = targetPy - pos.y;
        vel.vx = (dx === 0 ? 0 : dx > 0 ? 1 : -1) * def.speed;
        vel.vy = (dy === 0 ? 0 : dy > 0 ? 1 : -1) * def.speed;
      }
    }
  }

  /**
   * External call when a player feeds the animal. Handled outside the
   * normal update loop because it is interaction-driven.
   */
  feedEntity(entity: Entity, playerId: string): boolean {
    const animal = entity.getComponent("animal") as AnimalComponent | null;
    if (!animal || animal.ownerId !== null) return false;

    const def = ANIMAL_DEFINITIONS[animal.speciesId as AnimalSpecies];
    animal.feedCount++;
    animal.version++;

    if (animal.feedCount >= def.tamingFeedCount) {
      animal.ownerId = playerId;
      animal.behavior = "follow";
      this.onTame?.();
      return true;
    }

    return false;
  }
}

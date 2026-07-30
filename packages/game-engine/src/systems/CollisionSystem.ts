import { TILE_SIZE } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { PositionComponent } from "../components/PositionComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { ColliderComponent } from "../components/ColliderComponent";
import type { TileQuery } from "../world/TileQuery";
import type { StructureQuery } from "../world/StructureQuery";

/**
 * CollisionSystem vetoes movement into non-walkable tiles.
 *
 * It runs between InputSystem and MovementSystem and zeroes the offending
 * velocity axis, so MovementSystem stays a plain integrator. Because the axes
 * are tested independently, walking diagonally into a wall slides along it.
 *
 * Player-placed structures are vetoed the same way, through the occupancy index
 * `BuildSystem` maintains, so a fence blocks movement without changing the tile.
 */
export class CollisionSystem extends System {
  private tileQuery: TileQuery;
  private structures?: StructureQuery;

  constructor(tileQuery: TileQuery, structures?: StructureQuery) {
    super(["position", "velocity", "collider"]);
    this.tileQuery = tileQuery;
    this.structures = structures;
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const collider = entity.getComponent<ColliderComponent>("collider")!;
      if (!collider.enabled) continue;

      const position = entity.getComponent<PositionComponent>("position")!;
      const velocity = entity.getComponent<VelocityComponent>("velocity")!;

      const halfWidth = collider.width / 2;
      const halfHeight = collider.height / 2;

      if (velocity.vx !== 0) {
        const projectedX = position.x + velocity.vx * deltaTime;
        if (this.isBlocked(projectedX, position.y, halfWidth, halfHeight)) {
          velocity.vx = 0;
        }
      }

      if (velocity.vy !== 0) {
        const projectedY = position.y + velocity.vy * deltaTime;
        if (this.isBlocked(position.x, projectedY, halfWidth, halfHeight)) {
          velocity.vy = 0;
        }
      }
    }
  }

  /**
   * Probe the four corners of the collider box centred at (x, y).
   */
  private isBlocked(
    x: number,
    y: number,
    halfWidth: number,
    halfHeight: number,
  ): boolean {
    return (
      this.isSolidAt(x - halfWidth, y - halfHeight) ||
      this.isSolidAt(x + halfWidth, y - halfHeight) ||
      this.isSolidAt(x - halfWidth, y + halfHeight) ||
      this.isSolidAt(x + halfWidth, y + halfHeight)
    );
  }

  /** Whether the world pixel is inside a non-walkable tile or a solid structure. */
  private isSolidAt(pixelX: number, pixelY: number): boolean {
    if (!this.tileQuery.isWalkableAt(pixelX, pixelY)) return true;
    if (!this.structures) return false;

    return this.structures.isBlockedByStructure(
      Math.floor(pixelX / TILE_SIZE),
      Math.floor(pixelY / TILE_SIZE),
    );
  }
}

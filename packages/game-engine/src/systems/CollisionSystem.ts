import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { PositionComponent } from "../components/PositionComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { ColliderComponent } from "../components/ColliderComponent";
import type { TileQuery } from "../world/TileQuery";

/**
 * CollisionSystem vetoes movement into non-walkable tiles.
 *
 * It runs between InputSystem and MovementSystem and zeroes the offending
 * velocity axis, so MovementSystem stays a plain integrator. Because the axes
 * are tested independently, walking diagonally into a wall slides along it.
 */
export class CollisionSystem extends System {
  private tileQuery: TileQuery;

  constructor(tileQuery: TileQuery) {
    super(["position", "velocity", "collider"]);
    this.tileQuery = tileQuery;
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
      !this.tileQuery.isWalkableAt(x - halfWidth, y - halfHeight) ||
      !this.tileQuery.isWalkableAt(x + halfWidth, y - halfHeight) ||
      !this.tileQuery.isWalkableAt(x - halfWidth, y + halfHeight) ||
      !this.tileQuery.isWalkableAt(x + halfWidth, y + halfHeight)
    );
  }
}

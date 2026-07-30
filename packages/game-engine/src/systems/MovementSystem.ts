import { CHUNK_SIZE, TILE_SIZE } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { PositionComponent } from "../components/PositionComponent";
import { VelocityComponent } from "../components/VelocityComponent";

/**
 * MovementSystem applies velocity to position each frame.
 * Also updates chunk coordinates based on current position.
 */
export class MovementSystem extends System {
  constructor() {
    super(["position", "velocity"]);
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const position = entity.getComponent<PositionComponent>("position")!;
      const velocity = entity.getComponent<VelocityComponent>("velocity")!;

      position.x += velocity.vx * deltaTime;
      position.y += velocity.vy * deltaTime;

      // Update chunk coordinates
      const chunkPixelSize = CHUNK_SIZE * TILE_SIZE;
      position.chunkX = Math.floor(position.x / chunkPixelSize);
      position.chunkY = Math.floor(position.y / chunkPixelSize);
    }
  }
}

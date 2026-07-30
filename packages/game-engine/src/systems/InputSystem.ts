import { PLAYER_SPEED } from "@worldnest/shared";
import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { InputComponent } from "../components/InputComponent";
import { VelocityComponent } from "../components/VelocityComponent";
import { PlayerComponent } from "../components/PlayerComponent";

/**
 * InputSystem translates keyboard input state into velocity for the local player.
 */
export class InputSystem extends System {
  constructor() {
    super(["input", "velocity", "player"]);
  }

  update(entities: Entity[], _deltaTime: number): void {
    for (const entity of entities) {
      const player = entity.getComponent<PlayerComponent>("player")!;
      if (!player.isLocal) continue;

      const input = entity.getComponent<InputComponent>("input")!;
      const velocity = entity.getComponent<VelocityComponent>("velocity")!;

      velocity.vx = 0;
      velocity.vy = 0;

      if (input.keys.left) velocity.vx -= PLAYER_SPEED;
      if (input.keys.right) velocity.vx += PLAYER_SPEED;
      if (input.keys.up) velocity.vy -= PLAYER_SPEED;
      if (input.keys.down) velocity.vy += PLAYER_SPEED;

      // Normalize diagonal movement
      if (velocity.vx !== 0 && velocity.vy !== 0) {
        const factor = 1 / Math.sqrt(2);
        velocity.vx *= factor;
        velocity.vy *= factor;
      }
    }
  }
}

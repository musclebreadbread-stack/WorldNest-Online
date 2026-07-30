import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { advanceAnimation } from "../animation/animationOps";
import type { AnimationComponent } from "../components/AnimationComponent";
import type { SpriteComponent } from "../components/SpriteComponent";
import type { VelocityComponent } from "../components/VelocityComponent";

/**
 * AnimationSystem derives sprite animation from movement.
 *
 * It runs after collision and movement have settled the velocity for the frame,
 * so a player pushed against a wall reads as idle rather than walking, and writes
 * the resulting frame onto `SpriteComponent.frame` for the render layer.
 *
 * Remote players have no velocity — `InterpolationSystem` advances their
 * animation from the distance it actually moved them instead.
 */
export class AnimationSystem extends System {
  constructor() {
    super(["velocity", "animation", "sprite"]);
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const velocity = entity.getComponent<VelocityComponent>("velocity")!;
      const animation = entity.getComponent<AnimationComponent>("animation")!;
      const sprite = entity.getComponent<SpriteComponent>("sprite")!;

      advanceAnimation(animation, velocity.vx, velocity.vy, deltaTime);
      sprite.frame = animation.frameIndex;
    }
  }
}

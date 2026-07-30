import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { advanceAnimation } from "../animation/animationOps";
import { PositionComponent } from "../components/PositionComponent";
import { RemoteInterpolationComponent } from "../components/RemoteInterpolationComponent";
import type { AnimationComponent } from "../components/AnimationComponent";
import type { SpriteComponent } from "../components/SpriteComponent";

/** Distance below which the position snaps to the target, in pixels. */
const SNAP_DISTANCE = 0.5;

/** Reference frame rate the per-frame lerp factor is expressed against. */
const REFERENCE_FPS = 60;

/**
 * InterpolationSystem eases remote entity positions toward their network target.
 *
 * The per-frame factor is converted to a time-based one with
 * `1 - (1 - lerpFactor) ** (deltaTime * 60)`, which makes the smoothing
 * frame-rate independent: two 1/60 s steps move exactly as far as one 1/30 s step.
 *
 * Remote entities carry no velocity — adding one would let `MovementSystem`
 * integrate it and fight the smoothing — so when an entity has an
 * `AnimationComponent` this system also advances it from the distance it just
 * moved, which is what makes remote players animate through the same code path.
 */
export class InterpolationSystem extends System {
  constructor() {
    super(["position", "remoteInterpolation"]);
  }

  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      const position = entity.getComponent<PositionComponent>("position")!;
      const interpolation =
        entity.getComponent<RemoteInterpolationComponent>("remoteInterpolation")!;

      const alpha =
        1 - Math.pow(1 - interpolation.lerpFactor, deltaTime * REFERENCE_FPS);

      const previousX = position.x;
      const previousY = position.y;
      position.x = this.step(position.x, interpolation.targetX, alpha);
      position.y = this.step(position.y, interpolation.targetY, alpha);

      this.animate(entity, position.x - previousX, position.y - previousY, deltaTime);
    }
  }

  /** Drive a remote entity's animation from the movement it just performed. */
  private animate(entity: Entity, dx: number, dy: number, deltaTime: number): void {
    const animation = entity.getComponent<AnimationComponent>("animation");
    if (!animation) return;

    advanceAnimation(animation, dx, dy, deltaTime);

    const sprite = entity.getComponent<SpriteComponent>("sprite");
    if (sprite) {
      sprite.frame = animation.frameIndex;
    }
  }

  private step(current: number, target: number, alpha: number): number {
    if (Math.abs(target - current) <= SNAP_DISTANCE) {
      return target;
    }
    return current + (target - current) * alpha;
  }
}

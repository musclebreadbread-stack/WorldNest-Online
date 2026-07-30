import { Entity } from "../ecs/Entity";
import { System } from "../ecs/System";
import { PositionComponent } from "../components/PositionComponent";
import { RemoteInterpolationComponent } from "../components/RemoteInterpolationComponent";

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

      position.x = this.step(position.x, interpolation.targetX, alpha);
      position.y = this.step(position.y, interpolation.targetY, alpha);
    }
  }

  private step(current: number, target: number, alpha: number): number {
    if (Math.abs(target - current) <= SNAP_DISTANCE) {
      return target;
    }
    return current + (target - current) * alpha;
  }
}

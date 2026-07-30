import type { AnimationComponent } from "../components/AnimationComponent";
import type { Facing } from "../interaction/facing";

/** Movement below this magnitude counts as standing still. */
const MOVEMENT_EPSILON = 0.001;

/**
 * Facing implied by a movement delta, or `null` when there is no movement.
 * The dominant axis wins; ties go to the vertical direction, which matches how
 * `PlayerController` picks the interaction facing.
 */
export function directionFromDelta(dx: number, dy: number): Facing | null {
  if (Math.abs(dx) < MOVEMENT_EPSILON && Math.abs(dy) < MOVEMENT_EPSILON) {
    return null;
  }

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

/**
 * Advance an animation by one frame of simulation.
 *
 * A moving entity walks in the direction of its dominant axis and cycles frames
 * every `frameDurationMs`; a still one drops to the idle pose (frame 0) and
 * keeps the direction it stopped in, so the sprite stays aimed at the tile the
 * player is about to interact with. Pure and deterministic given fixed deltas,
 * which is what makes it testable without a renderer.
 */
export function advanceAnimation(
  animation: AnimationComponent,
  dx: number,
  dy: number,
  deltaTime: number,
): void {
  const direction = directionFromDelta(dx, dy);

  if (!direction) {
    animation.state = "idle";
    animation.elapsed = 0;
    animation.frameIndex = 0;
    return;
  }

  animation.state = "walk";
  animation.direction = direction;
  animation.elapsed += deltaTime * 1000;

  while (animation.elapsed >= animation.frameDurationMs) {
    animation.elapsed -= animation.frameDurationMs;
    animation.frameIndex = (animation.frameIndex + 1) % animation.frameCount;
  }
}

/**
 * Texture key for one directional frame, e.g. `player_left_1`.
 * Shared by the texture generator and the sprite layer so the two cannot drift.
 */
export function directionalTextureKey(
  textureKey: string,
  direction: Facing,
  frameIndex: number,
): string {
  return `${textureKey}_${direction}_${frameIndex}`;
}

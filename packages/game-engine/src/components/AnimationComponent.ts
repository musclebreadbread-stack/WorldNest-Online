import { Component } from "../ecs/Component";
import type { Facing } from "../interaction/facing";

/** Whether the entity is standing still or walking. */
export type AnimationState = "idle" | "walk";

/** Default time each walk frame is held, in milliseconds. */
export const DEFAULT_FRAME_DURATION_MS = 160;

/** Frames in a walk cycle; the placeholder spritesheet has two per direction. */
export const DEFAULT_FRAME_COUNT = 2;

/**
 * Animation state for a directional sprite: which way it faces, whether it is
 * walking, and where it is in the walk cycle.
 *
 * Pure data, like every component — `advanceAnimation` in `src/animation` owns
 * the transitions and `AnimationSystem` applies them once per frame.
 */
export class AnimationComponent extends Component {
  public state: AnimationState;
  public direction: Facing;
  /** Milliseconds accumulated toward the next frame. */
  public elapsed: number;
  public frameIndex: number;
  public frameDurationMs: number;
  /** Number of frames in the walk cycle for this sprite. */
  public frameCount: number;

  constructor(
    direction: Facing = "down",
    frameDurationMs: number = DEFAULT_FRAME_DURATION_MS,
    frameCount: number = DEFAULT_FRAME_COUNT,
  ) {
    super("animation");
    this.state = "idle";
    this.direction = direction;
    this.elapsed = 0;
    this.frameIndex = 0;
    this.frameDurationMs = frameDurationMs;
    this.frameCount = frameCount;
  }
}

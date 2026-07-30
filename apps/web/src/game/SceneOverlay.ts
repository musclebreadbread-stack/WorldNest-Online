import type { DayPhase, Entity, WorldManager } from "@worldnest/game-engine";

/**
 * Everything a visual layer is allowed to read each frame.
 *
 * The context is assembled once by `GameScene` and handed to every overlay, so
 * a new layer costs one registration line instead of another block in
 * `GameScene.update` — the scene is at the ~300-line cap `CONTRIBUTING.md` sets.
 */
export interface OverlayContext {
  phase: DayPhase;
  buildMode: boolean;
  playerEntity: Entity;
  worldManager: WorldManager;
  deltaMs: number;
}

/**
 * A visual layer owned by the scene: the day/night tint, the build preview, the
 * minimap. Overlays read the context and draw; they never mutate ECS state.
 */
export interface SceneOverlay {
  update(ctx: OverlayContext): void;
  destroy(): void;
}

/**
 * Fans `update` and `destroy` out to its members, in registration order.
 * Owning the collection here is what keeps the scene's frame loop one line long
 * no matter how many layers Phase 3 adds.
 */
export class OverlayStack implements SceneOverlay {
  private overlays: SceneOverlay[] = [];

  /** Register an overlay and hand it back, so callers can keep a typed handle. */
  add<T extends SceneOverlay>(overlay: T): T {
    this.overlays.push(overlay);
    return overlay;
  }

  update(ctx: OverlayContext): void {
    for (const overlay of this.overlays) {
      overlay.update(ctx);
    }
  }

  /** Destroy every overlay and forget them, so a second call is a no-op. */
  destroy(): void {
    for (const overlay of this.overlays) {
      overlay.destroy();
    }
    this.overlays = [];
  }
}

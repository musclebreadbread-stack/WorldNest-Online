import Phaser from "phaser";
import { WorldLayer } from "@worldnest/game-engine";
import type { DayPhase } from "@worldnest/game-engine";
import type { OverlayContext, SceneOverlay } from "./SceneOverlay";

/** Colour and opacity of the screen tint for each phase of the day. */
const PHASE_TINTS: Record<DayPhase, { color: number; alpha: number }> = {
  dawn: { color: 0xffb74d, alpha: 0.18 },
  day: { color: 0xffffff, alpha: 0 },
  dusk: { color: 0xff7043, alpha: 0.22 },
  night: { color: 0x0d1b3a, alpha: 0.45 },
};

const UNDERGROUND_TINT = { color: 0x090b16, alpha: 0.62 };

/**
 * The rectangle is scroll-locked to the camera but still scaled by camera zoom,
 * so it is drawn several times larger than the viewport to stay full-bleed.
 */
const OVERSCAN = 4;

/** Above the world and sprites, below the Phaser HUD text. */
const OVERLAY_DEPTH = 900;

const TWEEN_DURATION_MS = 1000;

/**
 * DayNightOverlay tints the viewport according to the world clock phase.
 * Phase changes are tweened so dawn/dusk fade in instead of popping.
 */
export class DayNightOverlay implements SceneOverlay {
  private scene: Phaser.Scene;
  private rectangle: Phaser.GameObjects.Rectangle;
  private phase: DayPhase | null = null;
  private layer = WorldLayer.SURFACE;
  private tween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const { width, height } = scene.scale;
    this.rectangle = scene.add.rectangle(
      width / 2,
      height / 2,
      width * OVERSCAN,
      height * OVERSCAN,
      PHASE_TINTS.day.color,
      1,
    );
    this.rectangle.setScrollFactor(0);
    this.rectangle.setDepth(OVERLAY_DEPTH);
    this.rectangle.setAlpha(0);

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
  }

  update(ctx: OverlayContext): void {
    this.setTint(ctx.phase, ctx.layer);
  }

  /** Fade to the surface phase tint; used to prime the scene at boot. */
  setPhase(phase: DayPhase): void {
    this.setTint(phase, this.layer);
  }

  private setTint(phase: DayPhase, layer: WorldLayer): void {
    if (phase === this.phase && layer === this.layer) return;
    this.phase = phase;
    this.layer = layer;

    const tint =
      layer === WorldLayer.UNDERGROUND ? UNDERGROUND_TINT : PHASE_TINTS[phase];
    this.rectangle.setFillStyle(tint.color, 1);

    this.tween?.stop();
    this.tween = this.scene.tweens.add({
      targets: this.rectangle,
      alpha: tint.alpha,
      duration: TWEEN_DURATION_MS,
      ease: "Sine.easeInOut",
    });
  }

  destroy(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.tween?.stop();
    this.tween = null;
    this.rectangle.destroy();
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.rectangle.setPosition(gameSize.width / 2, gameSize.height / 2);
    this.rectangle.setSize(gameSize.width * OVERSCAN, gameSize.height * OVERSCAN);
  }
}

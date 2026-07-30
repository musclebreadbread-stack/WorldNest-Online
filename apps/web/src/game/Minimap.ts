import Phaser from "phaser";
import { minimapTileAt, sampleMinimap, TILE_PROPERTIES } from "@worldnest/game-engine";
import type {
  Entity,
  MinimapSample,
  PlayerComponent,
  PositionComponent,
  World,
} from "@worldnest/game-engine";
import type { OverlayContext, SceneOverlay } from "./SceneOverlay";
import {
  MINIMAP_PIXELS_PER_TILE,
  MINIMAP_RADIUS_TILES,
  minimapAnchor,
  minimapDotOffset,
  minimapPixelSize,
  tileOf,
} from "./minimapLayout";
import { useUIStore } from "../stores/uiStore";

/** Above the world and the day/night tint, below the Phaser HUD text. */
const MINIMAP_DEPTH = 900;

/** Redraw at most this often even while the player keeps walking. */
const REDRAW_INTERVAL_MS = 500;

const BORDER_COLOR = 0xf5f5f5;
const BORDER_ALPHA = 0.7;
const BACKGROUND_ALPHA = 0.55;
const TERRAIN_ALPHA = 0.85;
const LOCAL_DOT_COLOR = 0xffffff;
/** Matches the tint `SpriteSync` puts on remote player sprites. */
const REMOTE_DOT_COLOR = 0xff8a80;
const LOCAL_DOT_RADIUS = 2.5;
const REMOTE_DOT_RADIUS = 2;

/**
 * Minimap paints the terrain around the player in the top-right corner.
 *
 * All the sampling lives in the engine's pure `sampleMinimap`, so this class only
 * maps tile ids to `TILE_PROPERTIES[t].color` — there is no second copy of the
 * terrain rules here, and the geometry it does own is in the Phaser-free
 * `minimapLayout` module so it can be unit-tested.
 *
 * Redraws are throttled: a full 49x49 window is only re-sampled when the player
 * crosses a tile boundary or every 500 ms, whichever comes first.
 */
export class Minimap implements SceneOverlay {
  private scene: Phaser.Scene;
  private world: World;
  private graphics: Phaser.GameObjects.Graphics;
  private size = minimapPixelSize();
  private sample: MinimapSample | null = null;
  private lastTileX = Number.NaN;
  private lastTileY = Number.NaN;
  private sinceRedrawMs = REDRAW_INTERVAL_MS;

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;

    this.graphics = scene.add.graphics();
    this.graphics.setScrollFactor(0);
    this.graphics.setDepth(MINIMAP_DEPTH);
    this.graphics.setVisible(false);
    this.layout();

    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
  }

  update(ctx: OverlayContext): void {
    if (!useUIStore.getState().minimapOpen) {
      this.graphics.setVisible(false);
      // Force a redraw the next time it is opened, however little has moved
      this.sinceRedrawMs = REDRAW_INTERVAL_MS;
      return;
    }

    const position = ctx.playerEntity.getComponent<PositionComponent>("position");
    if (!position) return;

    this.graphics.setVisible(true);
    this.sinceRedrawMs += ctx.deltaMs;

    const { tileX, tileY } = tileOf(position.x, position.y);
    const moved = tileX !== this.lastTileX || tileY !== this.lastTileY;
    if (!moved && this.sinceRedrawMs < REDRAW_INTERVAL_MS) return;

    this.lastTileX = tileX;
    this.lastTileY = tileY;
    this.sinceRedrawMs = 0;
    this.sample = sampleMinimap(
      ctx.worldManager,
      tileX,
      tileY,
      MINIMAP_RADIUS_TILES,
    );

    this.layout();
    this.redraw(position);
  }

  destroy(): void {
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.graphics.destroy();
  }

  /**
   * Undo the camera zoom and pin the graphics to the top-right of the viewport,
   * so one drawing unit is one screen pixel.
   */
  private layout(): void {
    const camera = this.scene.cameras.main;
    if (!camera) return;

    const zoom = camera.zoom || 1;
    const anchor = minimapAnchor(camera.width, camera.height, zoom, this.size);
    this.graphics.setScale(1 / zoom);
    this.graphics.setPosition(anchor.x, anchor.y);
  }

  private redraw(position: PositionComponent): void {
    const sample = this.sample;
    if (!sample) return;

    this.graphics.clear();
    this.graphics.fillStyle(0x000000, BACKGROUND_ALPHA);
    this.graphics.fillRect(0, 0, this.size, this.size);
    this.drawTerrain(sample);

    this.graphics.lineStyle(1, BORDER_COLOR, BORDER_ALPHA);
    this.graphics.strokeRect(0, 0, this.size, this.size);

    this.drawRemotePlayers(sample);
    this.drawDot(sample, position.x, position.y, LOCAL_DOT_COLOR, LOCAL_DOT_RADIUS);
  }

  private drawTerrain(sample: MinimapSample): void {
    for (let y = 0; y < sample.size; y++) {
      for (let x = 0; x < sample.size; x++) {
        const tile = minimapTileAt(sample, x, y)!;
        this.graphics.fillStyle(TILE_PROPERTIES[tile].color, TERRAIN_ALPHA);
        this.graphics.fillRect(
          x * MINIMAP_PIXELS_PER_TILE,
          y * MINIMAP_PIXELS_PER_TILE,
          MINIMAP_PIXELS_PER_TILE,
          MINIMAP_PIXELS_PER_TILE,
        );
      }
    }
  }

  /**
   * Remote players are read straight off the ECS, the same source the sprites
   * and name tags use, so a player on the minimap is a player in the world.
   */
  private drawRemotePlayers(sample: MinimapSample): void {
    for (const entity of this.world.getEntities()) {
      const position = remotePosition(entity);
      if (!position) continue;

      this.drawDot(
        sample,
        position.x,
        position.y,
        REMOTE_DOT_COLOR,
        REMOTE_DOT_RADIUS,
      );
    }
  }

  private drawDot(
    sample: MinimapSample,
    worldX: number,
    worldY: number,
    color: number,
    radius: number,
  ): void {
    const offset = minimapDotOffset(sample, worldX, worldY);
    if (!offset) return;

    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(offset.x, offset.y, radius);
  }
}

/** Position of an entity that is a remote player, or `null` for anything else. */
function remotePosition(entity: Entity): PositionComponent | null {
  const player = entity.getComponent<PlayerComponent>("player");
  if (!player || player.isLocal) return null;

  return entity.getComponent<PositionComponent>("position") ?? null;
}

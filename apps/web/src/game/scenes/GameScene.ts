import Phaser from "phaser";
import {
  World,
  Entity,
  VelocityComponent,
  NetworkComponent,
  TimeComponent,
  RenderSystem,
  WorldManager,
} from "@worldnest/game-engine";
import type { ChunkData } from "@worldnest/game-engine";
import type { RealtimeManager } from "@worldnest/database";
import { ChunkRenderer } from "../ChunkRenderer";
import { DayNightOverlay } from "../DayNightOverlay";
import { HudBridge } from "../HudBridge";
import { Minimap } from "../Minimap";
import { NetworkBridge } from "../NetworkBridge";
import { PlayerController } from "../PlayerController";
import { SpriteSync } from "../SpriteSync";
import { BuildGhost } from "../BuildGhost";
import { SoundManager } from "../audio/SoundManager";
import { OverlayStack, type OverlayContext } from "../SceneOverlay";
import {
  createSessionPersistence,
  type SessionPersistence,
} from "../SessionPersistence";
import {
  createGameWorld,
  BOOTSTRAP_REGISTRY_KEY,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
  type GameBootstrap,
} from "../createGameWorld";
import { useUIStore } from "../../stores/uiStore";

const FALLBACK_BOOTSTRAP: GameBootstrap = {
  playerId: "local",
  username: "Player",
  spawnX: DEFAULT_SPAWN_X,
  spawnY: DEFAULT_SPAWN_Y,
};

/**
 * GameScene is the main game scene.
 * Owns the Phaser side of the game: chunk textures, sprites, camera and input,
 * while all simulation lives in the ECS world built by `createGameWorld`.
 *
 * Everything that is not Phaser lives beside it: multiplayer plumbing in
 * `NetworkBridge`, HUD publishing in `HudBridge`, input in `PlayerController`,
 * and every visual layer as a `SceneOverlay` in `this.overlays` — so adding a
 * layer costs one registration line rather than another block in `update`.
 */
export class GameScene extends Phaser.Scene {
  private ecsWorld!: World;
  private worldManager!: WorldManager;
  private renderSystem!: RenderSystem;
  private playerEntity!: Entity;
  private clockEntity!: Entity;
  private chunkRenderer!: ChunkRenderer;
  private dayNight!: DayNightOverlay;
  private hudBridge!: HudBridge;
  private playerController!: PlayerController;
  /** Every visual layer, updated and destroyed as one. */
  private overlays = new OverlayStack();
  /** Realtime broadcasting and remote player entities. */
  private network!: NetworkBridge;
  /** Writes position, inventory and world changes back to Supabase. */
  private persistence: SessionPersistence | null = null;
  /** Owns the Phaser sprites mirrored from RenderSystem.renderData. */
  private spriteSync!: SpriteSync;

  constructor() {
    super({ key: "GameScene" });
  }

  /**
   * Set the realtime manager for multiplayer communication.
   * Should be called after the scene is created but before the game loop needs
   * it; `GameCanvas` calls this once the session is authenticated.
   */
  setRealtimeManager(manager: RealtimeManager): void {
    this.network.setTransport(manager);
  }

  create(): void {
    const bootstrap = this.getBootstrap();

    // Build the ECS world, systems and the local player entity
    const context = createGameWorld(bootstrap);
    this.ecsWorld = context.world;
    this.worldManager = context.worldManager;
    this.renderSystem = context.systems.render;
    this.playerEntity = context.playerEntity;
    this.clockEntity = context.clockEntity;
    this.network = new NetworkBridge(
      this.ecsWorld,
      this.playerEntity,
      context.systems.networkSync,
      this.game.events,
    );

    // Saved state was already restored by createGameWorld; from here on every
    // change is written back through this layer.
    this.persistence = createSessionPersistence(bootstrap, context);

    // Chunk rendering
    this.chunkRenderer = new ChunkRenderer(this);
    this.worldManager.setCallbacks(
      (chunk) => this.onChunkLoad(chunk),
      (chunkX, chunkY) => this.onChunkUnload(chunkX, chunkY),
    );
    // Harvested/modified tiles repaint in place instead of rebuilding the chunk,
    // and the same diff is what gets persisted
    this.worldManager.setTileChangeCallback((tileX, tileY, tileType) => {
      this.chunkRenderer.redrawTile(tileX, tileY, tileType);
      this.persistence?.saveTile(tileX, tileY, tileType);
    });

    // Prime the ECS once so chunks load and the render pass creates sprites
    this.spriteSync = new SpriteSync(this, this.ecsWorld);
    this.ecsWorld.update(0);
    this.spriteSync.sync(this.renderSystem.renderData);

    // Visual layers, in draw order. Each one only reads the overlay context.
    this.dayNight = this.overlays.add(new DayNightOverlay(this));
    this.dayNight.setPhase(this.getClockSnapshot().phase);
    this.overlays.add(new BuildGhost(this, this.playerEntity, context.systems.build));
    this.overlays.add(new Minimap(this, this.ecsWorld));
    // Not a visual layer, but it wants exactly the same per-frame context
    this.overlays.add(new SoundManager(this));

    // React HUD bridge
    this.hudBridge = new HudBridge(this.game.events, this.playerEntity, this.clockEntity);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlays.destroy();
      this.spriteSync.destroy();
      this.persistence?.flush();
      this.persistence?.destroy();
    });

    // Setup camera on the local player sprite created by the render pass
    const localSprite = this.spriteSync.get(this.playerEntity.id)!;
    this.cameras.main.startFollow(localSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // Keyboard bindings (movement, hotbar, panels, build mode)
    this.playerController = new PlayerController(this, this.playerEntity);

    // Emit ready event for React integration
    this.game.events.emit("game-ready");
  }

  update(_time: number, delta: number): void {
    const deltaSeconds = delta / 1000;

    // Update input components from keyboard state
    this.playerController.update();

    // Mark network dirty if moving
    const velocity = this.playerEntity.getComponent<VelocityComponent>("velocity")!;
    if (velocity.vx !== 0 || velocity.vy !== 0) {
      const network = this.playerEntity.getComponent<NetworkComponent>("network")!;
      network.dirty = true;
    }

    // Update ECS
    this.ecsWorld.update(deltaSeconds);

    // Flush network sync payloads to the realtime manager
    this.network.flushNetworkPayloads();

    // Mirror ECS render data onto Phaser sprites
    this.spriteSync.sync(this.renderSystem.renderData);

    // Day/night tint, build preview and every other visual layer
    this.overlays.update(this.getOverlayContext(delta));

    // Autosave position/inventory and push new structures and crops
    this.persistence?.update();

    // Publish the state the React HUD consumes
    this.hudBridge.flush();
  }

  /** Latest world clock snapshot, refreshed by TimeSystem each frame. */
  private getClockSnapshot() {
    return this.clockEntity.getComponent<TimeComponent>("time")!.snapshot;
  }

  /** The per-frame state every overlay is allowed to read. */
  private getOverlayContext(deltaMs: number): OverlayContext {
    return {
      phase: this.getClockSnapshot().phase,
      buildMode: useUIStore.getState().buildMode,
      playerEntity: this.playerEntity,
      worldManager: this.worldManager,
      deltaMs,
    };
  }

  /**
   * Read the bootstrap payload published by React, falling back to a local
   * anonymous player when the game runs without an authenticated session.
   */
  private getBootstrap(): GameBootstrap {
    const bootstrap = this.registry.get(BOOTSTRAP_REGISTRY_KEY) as
      | GameBootstrap
      | undefined;
    return bootstrap ?? FALLBACK_BOOTSTRAP;
  }

  private onChunkLoad(chunk: ChunkData): void {
    this.chunkRenderer.drawChunk(chunk);
  }

  private onChunkUnload(chunkX: number, chunkY: number): void {
    this.chunkRenderer.removeChunk(chunkX, chunkY);
  }
}

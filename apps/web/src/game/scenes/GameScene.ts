import Phaser from "phaser";
import {
  World,
  Entity,
  PositionComponent,
  VelocityComponent,
  NetworkComponent,
  PlayerComponent,
  RemoteInterpolationComponent,
  TimeComponent,
  NetworkSyncSystem,
  RenderSystem,
  WorldManager,
} from "@worldnest/game-engine";
import type { ChunkData, RenderData } from "@worldnest/game-engine";
import type { RealtimeManager, PlayerPosition } from "@worldnest/database";
import { ChunkRenderer } from "../ChunkRenderer";
import { DayNightOverlay } from "../DayNightOverlay";
import { HudBridge } from "../HudBridge";
import { PlayerController } from "../PlayerController";
import {
  createGameWorld,
  createRemotePlayerEntity,
  remotePlayerEntityId,
  BOOTSTRAP_REGISTRY_KEY,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
  type GameBootstrap,
} from "../createGameWorld";
import { PLAYERS_CHANGED_EVENT, type PlayersChangedEvent } from "../events";

const LOCAL_PLAYER_DEPTH = 100;
const REMOTE_PLAYER_DEPTH = 99;
const REMOTE_PLAYER_TINT = 0xff8a80;
const SPRITE_SCALE = 2;

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
 * Wires ECS NetworkSync payloads to RealtimeManager for multiplayer broadcasting.
 */
export class GameScene extends Phaser.Scene {
  private ecsWorld!: World;
  private worldManager!: WorldManager;
  private networkSync!: NetworkSyncSystem;
  private renderSystem!: RenderSystem;
  private playerEntity!: Entity;
  private clockEntity!: Entity;
  private chunkRenderer!: ChunkRenderer;
  private dayNight!: DayNightOverlay;
  private hudBridge!: HudBridge;
  private playerController!: PlayerController;
  /** Phaser sprites keyed by ECS entity id, driven by RenderSystem.renderData. */
  private sprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private realtimeManager: RealtimeManager | null = null;

  constructor() {
    super({ key: "GameScene" });
  }

  /**
   * Set the realtime manager for multiplayer communication.
   * Should be called after the scene is created but before the game loop needs it.
   */
  setRealtimeManager(manager: RealtimeManager): void {
    this.realtimeManager = manager;

    // Wire up callbacks for remote players
    manager.setCallbacks(
      (player) =>
        this.addRemotePlayer(
          player.playerId,
          player.username,
          player.position.x,
          player.position.y,
        ),
      (playerId) => this.removeRemotePlayer(playerId),
      (playerId, position) => this.updateRemotePlayer(playerId, position.x, position.y),
    );

    // Seed the manager with the real spawn point so joinRoom does not track (0, 0)
    void manager.updatePresence(this.getLocalPlayerPosition());
  }

  create(): void {
    const bootstrap = this.getBootstrap();

    // Build the ECS world, systems and the local player entity
    const context = createGameWorld(bootstrap);
    this.ecsWorld = context.world;
    this.worldManager = context.worldManager;
    this.networkSync = context.systems.networkSync;
    this.renderSystem = context.systems.render;
    this.playerEntity = context.playerEntity;
    this.clockEntity = context.clockEntity;

    // Chunk rendering
    this.chunkRenderer = new ChunkRenderer(this);
    this.worldManager.setCallbacks(
      (chunk) => this.onChunkLoad(chunk),
      (chunkX, chunkY) => this.onChunkUnload(chunkX, chunkY),
    );

    // Prime the ECS once so chunks load and the render pass creates sprites
    this.ecsWorld.update(0);
    this.syncSprites();

    // Day/night tint and the React HUD bridge
    this.dayNight = new DayNightOverlay(this);
    this.dayNight.setPhase(this.getClockSnapshot().phase);
    this.hudBridge = new HudBridge(this.game.events, this.playerEntity, this.clockEntity);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.dayNight.destroy());

    // Setup camera on the local player sprite created by the render pass
    const localSprite = this.sprites.get(this.playerEntity.id)!;
    this.cameras.main.startFollow(localSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // Keyboard bindings (movement, hotbar, panels)
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

    // Flush network sync payloads to realtime manager
    this.flushNetworkPayloads();

    // Mirror ECS render data onto Phaser sprites
    this.syncSprites();

    // Day/night tint follows the world clock phase
    this.dayNight.setPhase(this.getClockSnapshot().phase);

    // Publish the state the React HUD consumes
    this.hudBridge.flush();
  }

  /** Latest world clock snapshot, refreshed by TimeSystem each frame. */
  private getClockSnapshot() {
    return this.clockEntity.getComponent<TimeComponent>("time")!.snapshot;
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

  /**
   * Flush pending network sync payloads to the RealtimeManager.
   */
  private flushNetworkPayloads(): void {
    if (!this.realtimeManager) return;

    const payloads = this.networkSync.getPendingPayloads();
    for (const payload of payloads) {
      const position = this.playerEntity.getComponent<PositionComponent>("position")!;
      const broadcastPosition: PlayerPosition = {
        x: payload.x,
        y: payload.y,
        chunkX: position.chunkX,
        chunkY: position.chunkY,
      };
      this.realtimeManager.broadcastPosition(broadcastPosition);
      // Presence is throttled inside the manager; late joiners need it to be current
      void this.realtimeManager.updatePresence(broadcastPosition);
    }
  }

  /** Current local player position in the shape the realtime layer expects. */
  private getLocalPlayerPosition(): PlayerPosition {
    const position = this.playerEntity.getComponent<PositionComponent>("position")!;
    return {
      x: position.x,
      y: position.y,
      chunkX: position.chunkX,
      chunkY: position.chunkY,
    };
  }

  private onChunkLoad(chunk: ChunkData): void {
    this.chunkRenderer.drawChunk(chunk);
  }

  private onChunkUnload(chunkX: number, chunkY: number): void {
    this.chunkRenderer.removeChunk(chunkX, chunkY);
  }

  /**
   * Create or update the Phaser sprite for every entity the RenderSystem reported,
   * and destroy sprites whose entity is gone. This is the only place sprites are
   * positioned, so ECS state is the single source of truth.
   */
  private syncSprites(): void {
    const seen = new Set<string>();

    for (const data of this.renderSystem.renderData) {
      seen.add(data.entityId);
      const sprite = this.sprites.get(data.entityId) ?? this.createSprite(data);

      if (sprite.texture.key !== data.textureKey) {
        sprite.setTexture(data.textureKey);
      }
      sprite.setPosition(data.x, data.y);
      sprite.setVisible(data.visible);
    }

    for (const [entityId, sprite] of this.sprites) {
      if (!seen.has(entityId)) {
        sprite.destroy();
        this.sprites.delete(entityId);
      }
    }
  }

  private createSprite(data: RenderData): Phaser.GameObjects.Sprite {
    const sprite = this.add.sprite(data.x, data.y, data.textureKey);
    sprite.setScale(SPRITE_SCALE);

    const player = this.ecsWorld
      .getEntity(data.entityId)
      ?.getComponent<PlayerComponent>("player");
    const isLocal = player?.isLocal ?? false;

    sprite.setDepth(isLocal ? LOCAL_PLAYER_DEPTH : REMOTE_PLAYER_DEPTH);
    if (player && !isLocal) {
      sprite.setTint(REMOTE_PLAYER_TINT);
    }

    this.sprites.set(data.entityId, sprite);
    return sprite;
  }

  /**
   * Add a remote player as a real ECS entity so it shares the render path
   * and gets network smoothing from the InterpolationSystem.
   */
  addRemotePlayer(playerId: string, username: string, x: number, y: number): void {
    const entityId = remotePlayerEntityId(playerId);
    if (this.ecsWorld.getEntity(entityId)) return;

    this.ecsWorld.addEntity(createRemotePlayerEntity(playerId, username, x, y));
    this.emitPlayersChanged({ type: "join", playerId, username, x, y });
  }

  /**
   * Write a remote player's latest network position as the interpolation target.
   */
  updateRemotePlayer(playerId: string, x: number, y: number): void {
    const entity = this.ecsWorld.getEntity(remotePlayerEntityId(playerId));
    if (!entity) {
      // A position broadcast can arrive before the presence join event
      this.addRemotePlayer(playerId, playerId, x, y);
      return;
    }

    const interpolation = entity.getComponent<RemoteInterpolationComponent>(
      "remoteInterpolation",
    )!;
    interpolation.targetX = x;
    interpolation.targetY = y;

    this.emitPlayersChanged({ type: "move", playerId, x, y });
  }

  /**
   * Remove a remote player entity; its sprite is cleaned up by `syncSprites`.
   */
  removeRemotePlayer(playerId: string): void {
    const entityId = remotePlayerEntityId(playerId);
    if (!this.ecsWorld.getEntity(entityId)) return;

    this.ecsWorld.removeEntity(entityId);
    this.emitPlayersChanged({ type: "leave", playerId });
  }

  private emitPlayersChanged(event: PlayersChangedEvent): void {
    this.game.events.emit(PLAYERS_CHANGED_EVENT, event);
  }
}

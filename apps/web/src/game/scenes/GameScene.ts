import Phaser from "phaser";
import {
  World,
  Entity,
  PositionComponent,
  VelocityComponent,
  InputComponent,
  NetworkComponent,
  NetworkSyncSystem,
  WorldManager,
} from "@worldnest/game-engine";
import type { ChunkData } from "@worldnest/game-engine";
import type { RealtimeManager, PlayerPosition } from "@worldnest/database";
import { ChunkRenderer } from "../ChunkRenderer";
import {
  createGameWorld,
  BOOTSTRAP_REGISTRY_KEY,
  DEFAULT_SPAWN_X,
  DEFAULT_SPAWN_Y,
  type GameBootstrap,
} from "../createGameWorld";

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
  private playerEntity!: Entity;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private chunkRenderer!: ChunkRenderer;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private otherPlayers: Map<string, Phaser.GameObjects.Sprite> = new Map();
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
        this.addRemotePlayer(player.playerId, player.position.x, player.position.y),
      (playerId) => this.removeRemotePlayer(playerId),
      (playerId, position) => this.updateRemotePlayer(playerId, position.x, position.y),
    );
  }

  create(): void {
    const bootstrap = this.getBootstrap();

    // Build the ECS world, systems and the local player entity
    const context = createGameWorld(bootstrap);
    this.ecsWorld = context.world;
    this.worldManager = context.worldManager;
    this.networkSync = context.systems.networkSync;
    this.playerEntity = context.playerEntity;

    // Chunk rendering
    this.chunkRenderer = new ChunkRenderer(this);
    this.worldManager.setCallbacks(
      (chunk) => this.onChunkLoad(chunk),
      (chunkX, chunkY) => this.onChunkUnload(chunkX, chunkY),
    );

    // Create player sprite
    this.playerSprite = this.add.sprite(bootstrap.spawnX, bootstrap.spawnY, "player");
    this.playerSprite.setScale(2);
    this.playerSprite.setDepth(100);

    // Setup camera
    this.cameras.main.startFollow(this.playerSprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(2);

    // Setup input
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }

    // Initial chunk load
    const pos = this.playerEntity.getComponent<PositionComponent>("position")!;
    this.worldManager.updateLoadedChunks(pos.chunkX, pos.chunkY);

    // Emit ready event for React integration
    this.game.events.emit("game-ready");
  }

  update(_time: number, delta: number): void {
    const deltaSeconds = delta / 1000;

    // Update input component from keyboard state
    const input = this.playerEntity.getComponent<InputComponent>("input")!;
    if (this.cursors && this.wasdKeys) {
      input.keys.up = this.cursors.up.isDown || this.wasdKeys.W.isDown;
      input.keys.down = this.cursors.down.isDown || this.wasdKeys.S.isDown;
      input.keys.left = this.cursors.left.isDown || this.wasdKeys.A.isDown;
      input.keys.right = this.cursors.right.isDown || this.wasdKeys.D.isDown;
    }

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

    // Sync sprite position with ECS position
    const position = this.playerEntity.getComponent<PositionComponent>("position")!;
    this.playerSprite.setPosition(position.x, position.y);

    // Emit position for React store
    this.game.events.emit("player-position", {
      x: position.x,
      y: position.y,
      chunkX: position.chunkX,
      chunkY: position.chunkY,
    });
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
    }
  }

  private onChunkLoad(chunk: ChunkData): void {
    this.chunkRenderer.drawChunk(chunk);
  }

  private onChunkUnload(chunkX: number, chunkY: number): void {
    this.chunkRenderer.removeChunk(chunkX, chunkY);
  }

  /**
   * Add a remote player sprite to the scene.
   */
  addRemotePlayer(playerId: string, x: number, y: number): void {
    if (this.otherPlayers.has(playerId)) return;

    const sprite = this.add.sprite(x, y, "player");
    sprite.setScale(2);
    sprite.setDepth(99);
    sprite.setTint(0xff8a80); // Tint remote players
    this.otherPlayers.set(playerId, sprite);
  }

  /**
   * Update a remote player's position.
   */
  updateRemotePlayer(playerId: string, x: number, y: number): void {
    const sprite = this.otherPlayers.get(playerId);
    if (sprite) {
      sprite.setPosition(x, y);
    }
  }

  /**
   * Remove a remote player from the scene.
   */
  removeRemotePlayer(playerId: string): void {
    const sprite = this.otherPlayers.get(playerId);
    if (sprite) {
      sprite.destroy();
      this.otherPlayers.delete(playerId);
    }
  }
}

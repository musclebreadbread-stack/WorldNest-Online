import Phaser from "phaser";
import {
  World,
  Entity,
  PositionComponent,
  VelocityComponent,
  SpriteComponent,
  PlayerComponent,
  InputComponent,
  NetworkComponent,
  MovementSystem,
  InputSystem,
  ChunkSystem,
  NetworkSyncSystem,
  WorldManager,
  TileType,
} from "@worldnest/game-engine";
import { CHUNK_SIZE, TILE_SIZE, WORLD_SEED } from "@worldnest/shared";
import type { ChunkData } from "@worldnest/game-engine";
import type { RealtimeManager, PlayerPosition } from "@worldnest/database";

/**
 * GameScene is the main game scene.
 * Creates the tilemap from chunk data, renders player sprites, handles camera follow.
 * Wires ECS NetworkSync payloads to RealtimeManager for multiplayer broadcasting.
 */
export class GameScene extends Phaser.Scene {
  private ecsWorld!: World;
  private worldManager!: WorldManager;
  private networkSync!: NetworkSyncSystem;
  private playerEntity!: Entity;
  private playerSprite!: Phaser.GameObjects.Sprite;
  private chunkLayers: Map<string, Phaser.GameObjects.Container> = new Map();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
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
      (player) => this.addRemotePlayer(player.playerId, player.position.x, player.position.y),
      (playerId) => this.removeRemotePlayer(playerId),
      (playerId, position) => this.updateRemotePlayer(playerId, position.x, position.y),
    );
  }

  create(): void {
    // Setup ECS world
    this.ecsWorld = new World();
    this.worldManager = new WorldManager(WORLD_SEED, 1);

    // Set up chunk callbacks
    this.worldManager.setCallbacks(
      (chunk) => this.onChunkLoad(chunk),
      (chunkX, chunkY) => this.onChunkUnload(chunkX, chunkY),
    );

    // Create systems
    const inputSystem = new InputSystem();
    const movementSystem = new MovementSystem();
    const chunkSystem = new ChunkSystem(this.worldManager);
    this.networkSync = new NetworkSyncSystem(50);

    this.ecsWorld.addSystem(inputSystem);
    this.ecsWorld.addSystem(movementSystem);
    this.ecsWorld.addSystem(chunkSystem);
    this.ecsWorld.addSystem(this.networkSync);

    // Create local player entity
    this.playerEntity = new Entity("local-player");
    this.playerEntity
      .addComponent(new PositionComponent(256, 256))
      .addComponent(new VelocityComponent(0, 0))
      .addComponent(new SpriteComponent("player", 0, true))
      .addComponent(new PlayerComponent("local", "Player", true))
      .addComponent(new InputComponent())
      .addComponent(new NetworkComponent());

    this.ecsWorld.addEntity(this.playerEntity);

    // Create player sprite
    this.playerSprite = this.add.sprite(256, 256, "player");
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
    const key = `${chunk.chunkX},${chunk.chunkY}`;
    const chunkPixelSize = CHUNK_SIZE * TILE_SIZE;
    const offsetX = chunk.chunkX * chunkPixelSize;
    const offsetY = chunk.chunkY * chunkPixelSize;

    // Use a RenderTexture for batch rendering instead of one Sprite per tile.
    // All tiles are drawn once into the texture, reducing game objects from 256 to 1 per chunk.
    const renderTexture = this.add.renderTexture(
      offsetX,
      offsetY,
      chunkPixelSize,
      chunkPixelSize,
    );
    renderTexture.setOrigin(0, 0);

    // Use a temporary sprite to stamp each tile at the correct scale
    const scale = TILE_SIZE / 16; // Textures are 16x16, scale to TILE_SIZE
    const stampSprite = this.make.sprite({ key: "tile_0", add: false });
    stampSprite.setOrigin(0, 0);
    stampSprite.setScale(scale);

    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = chunk.tiles[y][x] as TileType;
        stampSprite.setTexture(`tile_${tileType}`);
        renderTexture.draw(stampSprite, x * TILE_SIZE, y * TILE_SIZE);
      }
    }

    stampSprite.destroy();
    renderTexture.setDepth(0);

    // Store as a container wrapper for consistent cleanup
    const container = this.add.container(0, 0, [renderTexture]);
    this.chunkLayers.set(key, container);

    console.log(`[WorldNest] Chunk loaded: ${key}`);
  }

  private onChunkUnload(chunkX: number, chunkY: number): void {
    const key = `${chunkX},${chunkY}`;
    const container = this.chunkLayers.get(key);
    if (container) {
      container.destroy(true);
      this.chunkLayers.delete(key);
    }

    console.log(`[WorldNest] Chunk unloaded: ${key}`);
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

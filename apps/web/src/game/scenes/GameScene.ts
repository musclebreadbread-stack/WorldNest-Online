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

/**
 * GameScene is the main game scene.
 * Creates the tilemap from chunk data, renders player sprites, handles camera follow.
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

  constructor() {
    super({ key: "GameScene" });
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

  private onChunkLoad(chunk: ChunkData): void {
    const key = `${chunk.chunkX},${chunk.chunkY}`;
    const chunkPixelSize = CHUNK_SIZE * TILE_SIZE;
    const offsetX = chunk.chunkX * chunkPixelSize;
    const offsetY = chunk.chunkY * chunkPixelSize;

    const container = this.add.container(offsetX, offsetY);

    // Render each tile in the chunk
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const tileType = chunk.tiles[y][x] as TileType;
        const tileSprite = this.add.sprite(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          `tile_${tileType}`,
        );
        tileSprite.setScale(TILE_SIZE / 16); // Scale 16px tiles to TILE_SIZE
        container.add(tileSprite);
      }
    }

    container.setDepth(0);
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

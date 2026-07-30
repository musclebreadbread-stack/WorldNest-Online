import {
  World,
  Entity,
  PositionComponent,
  VelocityComponent,
  SpriteComponent,
  PlayerComponent,
  InputComponent,
  NetworkComponent,
  InputSystem,
  MovementSystem,
  ChunkSystem,
  NetworkSyncSystem,
  WorldManager,
} from "@worldnest/game-engine";
import { SYNC_INTERVAL_MS, WORLD_SEED } from "@worldnest/shared";

/**
 * Identity and spawn data handed to the game by React through the Phaser registry.
 */
export interface GameBootstrap {
  playerId: string;
  username: string;
  spawnX: number;
  spawnY: number;
}

export interface GameWorldSystems {
  input: InputSystem;
  movement: MovementSystem;
  chunk: ChunkSystem;
  networkSync: NetworkSyncSystem;
}

export interface GameWorldContext {
  world: World;
  worldManager: WorldManager;
  systems: GameWorldSystems;
  playerEntity: Entity;
}

/** Registry key the bootstrap payload is published under. */
export const BOOTSTRAP_REGISTRY_KEY = "bootstrap";

export const LOCAL_PLAYER_ENTITY_ID = "local-player";

/** Fallback spawn point used when no saved player state exists. */
export const DEFAULT_SPAWN_X = 256;
export const DEFAULT_SPAWN_Y = 256;

/**
 * Build the ECS world, its systems and the local player entity.
 * Deliberately free of Phaser imports so the wiring can be reasoned about
 * (and later tested) without a rendering context.
 *
 * System registration order is execution order.
 */
export function createGameWorld(bootstrap: GameBootstrap): GameWorldContext {
  const world = new World();
  const worldManager = new WorldManager(WORLD_SEED, 1);

  const systems: GameWorldSystems = {
    input: new InputSystem(),
    movement: new MovementSystem(),
    chunk: new ChunkSystem(worldManager),
    networkSync: new NetworkSyncSystem(SYNC_INTERVAL_MS),
  };

  world.addSystem(systems.input);
  world.addSystem(systems.movement);
  world.addSystem(systems.chunk);
  world.addSystem(systems.networkSync);

  const playerEntity = new Entity(LOCAL_PLAYER_ENTITY_ID);
  playerEntity
    .addComponent(new PositionComponent(bootstrap.spawnX, bootstrap.spawnY))
    .addComponent(new VelocityComponent(0, 0))
    .addComponent(new SpriteComponent("player", 0, true))
    .addComponent(new PlayerComponent(bootstrap.playerId, bootstrap.username, true))
    .addComponent(new InputComponent())
    .addComponent(new NetworkComponent());

  world.addEntity(playerEntity);

  return { world, worldManager, systems, playerEntity };
}

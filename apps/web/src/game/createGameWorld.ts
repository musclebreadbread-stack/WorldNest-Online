import {
  World,
  Entity,
  PositionComponent,
  VelocityComponent,
  SpriteComponent,
  PlayerComponent,
  InputComponent,
  NetworkComponent,
  RemoteInterpolationComponent,
  ColliderComponent,
  TimeComponent,
  InventoryComponent,
  StatsComponent,
  InteractionComponent,
  DialogueComponent,
  AnimationComponent,
  TimeSystem,
  InputSystem,
  CollisionSystem,
  MovementSystem,
  ChunkSystem,
  InterpolationSystem,
  StatsSystem,
  NpcSystem,
  PlantSystem,
  CropGrowthSystem,
  BuildSystem,
  HarvestSystem,
  NetworkSyncSystem,
  AnimationSystem,
  RenderSystem,
  WorldManager,
  addItem,
  composeBlockers,
} from "@worldnest/game-engine";
import type { TileType } from "@worldnest/game-engine";
import { SYNC_INTERVAL_MS, WORLD_SEED, type ItemId } from "@worldnest/shared";
import type { PersistedInventory } from "@worldnest/database";
import { restoreInventory } from "../lib/inventorySnapshot";

/** A structure loaded from the database, ready to be respawned. */
export interface SavedStructure {
  itemId: ItemId;
  tileX: number;
  tileY: number;
}

/** A crop loaded from the database; `itemId` is the seed it was sown from. */
export interface SavedCrop extends SavedStructure {
  plantedAtMinute: number;
}

/**
 * Shared-world state restored on session start: the terrain diff plus every
 * structure and crop other sessions left behind.
 */
export interface SavedWorldState {
  /** `[tileKey, tileType]` pairs for `WorldManager.applyTileOverrides`. */
  tileOverrides: Array<[string, TileType]>;
  structures: SavedStructure[];
  crops: SavedCrop[];
}

/**
 * Identity, spawn and saved state handed to the game by React through the
 * Phaser registry. Everything past the identity is optional so the game still
 * boots when Supabase is unconfigured.
 */
export interface GameBootstrap {
  playerId: string;
  username: string;
  spawnX: number;
  spawnY: number;
  /** World rows are written against this id; `null` disables persistence. */
  worldId?: string | null;
  /** Saved inventory; when absent the starting kit is granted instead. */
  inventory?: PersistedInventory | null;
  /** Saved shared-world state, applied before the first chunk load. */
  savedWorld?: SavedWorldState | null;
}

export interface GameWorldSystems {
  time: TimeSystem;
  input: InputSystem;
  collision: CollisionSystem;
  movement: MovementSystem;
  chunk: ChunkSystem;
  interpolation: InterpolationSystem;
  stats: StatsSystem;
  npc: NpcSystem;
  plant: PlantSystem;
  cropGrowth: CropGrowthSystem;
  build: BuildSystem;
  harvest: HarvestSystem;
  networkSync: NetworkSyncSystem;
  animation: AnimationSystem;
  render: RenderSystem;
}

export interface GameWorldContext {
  world: World;
  worldManager: WorldManager;
  systems: GameWorldSystems;
  playerEntity: Entity;
  clockEntity: Entity;
}

/** Registry key the bootstrap payload is published under. */
export const BOOTSTRAP_REGISTRY_KEY = "bootstrap";

export const LOCAL_PLAYER_ENTITY_ID = "local-player";

/** Singleton entity carrying the shared world clock snapshot. */
export const WORLD_CLOCK_ENTITY_ID = "world-clock";

/**
 * Fallback spawn point used when no saved player state exists.
 * Centre of tile (15, 10), which is open grassland for `WORLD_SEED` — terrain is
 * deterministic, and now that collision is enabled a spawn inside water would
 * trap the player.
 */
export const DEFAULT_SPAWN_X = 496;
export const DEFAULT_SPAWN_Y = 336;

/** Player collision box, slightly smaller than a tile so doorways feel forgiving. */
export const PLAYER_COLLIDER_SIZE = 24;

/** Seeds handed to a new player so the farming loop is playable immediately. */
export const STARTING_WHEAT_SEEDS = 5;

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

  // The clock entity exists up front so systems can read the phase through a getter
  const clockEntity = new Entity(WORLD_CLOCK_ENTITY_ID);
  const timeComponent = new TimeComponent();
  clockEntity.addComponent(timeComponent);

  // Terrain edits go through the override layer, never into the generator
  const setTileOverride = (tileX: number, tileY: number, tileType: TileType) =>
    worldManager.setTileOverride(tileX, tileY, tileType);

  // Planting owns the crop index, which harvesting reads to find what is growing
  const plant = new PlantSystem(
    worldManager,
    setTileOverride,
    (entity) => world.addEntity(entity),
    (entityId) => world.removeEntity(entityId),
    () => timeComponent.snapshot.totalMinutes,
  );

  // Building owns the structure occupancy index, which collision reads as walls
  const build = new BuildSystem(worldManager, (entity) => world.addEntity(entity));

  // NPCs own their own occupancy index; composed with the structures below so a
  // villager is as solid as a fence without collision knowing either exists.
  const npc = new NpcSystem(worldManager, (entity) => world.addEntity(entity));

  const systems: GameWorldSystems = {
    // The clock runs first so every other system sees the same time this frame
    time: new TimeSystem(),
    input: new InputSystem(),
    // Collision runs between input and movement: it vetoes velocity before it is
    // integrated, which gives per-axis wall sliding for free.
    collision: new CollisionSystem(worldManager, composeBlockers(build, npc)),
    movement: new MovementSystem(),
    chunk: new ChunkSystem(worldManager),
    interpolation: new InterpolationSystem(),
    stats: new StatsSystem(() => timeComponent.snapshot.phase),
    // NPCs run before planting so talking to one can never till the ground they
    // are standing on: they consume the interact request first.
    npc,
    plant,
    cropGrowth: new CropGrowthSystem(() => timeComponent.snapshot.totalMinutes),
    build,
    // Planting runs first and only consumes the request when it acted, so an
    // interact it ignores still reaches harvesting this same frame.
    harvest: new HarvestSystem(worldManager, setTileOverride, plant),
    networkSync: new NetworkSyncSystem(SYNC_INTERVAL_MS),
    // Animation runs last before rendering: velocity has settled by then, so a
    // player held against a wall reads as idle rather than walking on the spot.
    animation: new AnimationSystem(),
    render: new RenderSystem(),
  };

  world.addSystem(systems.time);
  world.addSystem(systems.input);
  world.addSystem(systems.collision);
  world.addSystem(systems.movement);
  world.addSystem(systems.chunk);
  world.addSystem(systems.interpolation);
  world.addSystem(systems.stats);
  world.addSystem(systems.npc);
  world.addSystem(systems.plant);
  world.addSystem(systems.cropGrowth);
  world.addSystem(systems.build);
  world.addSystem(systems.harvest);
  world.addSystem(systems.networkSync);
  world.addSystem(systems.animation);
  world.addSystem(systems.render);

  // Saved terrain, structures and crops go in before the first chunk load so
  // the very first render pass already shows the restored world.
  if (bootstrap.savedWorld) {
    restoreSavedWorld(worldManager, plant, build, bootstrap.savedWorld);
  }

  const inventory = new InventoryComponent();
  if (bootstrap.inventory) {
    restoreInventory(inventory, bootstrap.inventory);
  } else {
    addItem(inventory, "wheat_seed", STARTING_WHEAT_SEEDS);
  }

  const playerEntity = new Entity(LOCAL_PLAYER_ENTITY_ID);
  playerEntity
    .addComponent(new PositionComponent(bootstrap.spawnX, bootstrap.spawnY))
    .addComponent(new VelocityComponent(0, 0))
    .addComponent(new SpriteComponent("player", 0, true))
    .addComponent(new PlayerComponent(bootstrap.playerId, bootstrap.username, true))
    .addComponent(new InputComponent())
    .addComponent(new NetworkComponent())
    .addComponent(new ColliderComponent(PLAYER_COLLIDER_SIZE, PLAYER_COLLIDER_SIZE))
    .addComponent(inventory)
    .addComponent(new StatsComponent())
    .addComponent(new InteractionComponent())
    .addComponent(new DialogueComponent())
    .addComponent(new AnimationComponent());

  world.addEntity(playerEntity);
  world.addEntity(clockEntity);

  return { world, worldManager, systems, playerEntity, clockEntity };
}

/**
 * Rehydrate saved world state. Structures and crops are respawned through the
 * owning systems' public spawn methods, which skip the inventory cost — a
 * restore must not charge the player for what they already built.
 */
function restoreSavedWorld(
  worldManager: WorldManager,
  plant: PlantSystem,
  build: BuildSystem,
  saved: SavedWorldState,
): void {
  worldManager.applyTileOverrides(saved.tileOverrides);

  for (const structure of saved.structures) {
    build.spawnStructure(structure.itemId, structure.tileX, structure.tileY);
  }

  for (const crop of saved.crops) {
    plant.spawnCrop(crop.itemId, crop.tileX, crop.tileY, crop.plantedAtMinute);
  }
}

/** Entity id used for the remote player owned by `playerId`. */
export function remotePlayerEntityId(playerId: string): string {
  return `remote-${playerId}`;
}

/**
 * Build a remote player entity. Remote players are real ECS entities so they
 * share the single render path and get network smoothing for free.
 */
export function createRemotePlayerEntity(
  playerId: string,
  username: string,
  x: number,
  y: number,
): Entity {
  const entity = new Entity(remotePlayerEntityId(playerId));
  entity
    .addComponent(new PositionComponent(x, y))
    .addComponent(new SpriteComponent("player", 0, true))
    .addComponent(new PlayerComponent(playerId, username, false))
    .addComponent(new RemoteInterpolationComponent(x, y))
    // No velocity component: MovementSystem would integrate it and fight the
    // smoothing, so InterpolationSystem drives this animation instead.
    .addComponent(new AnimationComponent());
  return entity;
}

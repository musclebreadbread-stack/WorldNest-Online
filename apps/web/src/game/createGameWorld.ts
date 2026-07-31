import {
  World,
  Entity,
  TimeComponent,
  TimeSystem,
  InputSystem,
  CollisionSystem,
  MovementSystem,
  ChunkSystem,
  InterpolationSystem,
  StatsSystem,
  NpcSystem,
  ShopSystem,
  QuestSystem,
  LayerSystem,
  PlantSystem,
  CropGrowthSystem,
  BuildSystem,
  HarvestSystem,
  NetworkSyncSystem,
  AnimationSystem,
  RenderSystem,
  WorldManager,
  composeBlockers,
  layerGuardedBlockers,
} from "@worldnest/game-engine";
import type { TileType } from "@worldnest/game-engine";
import { SYNC_INTERVAL_MS, WORLD_SEED } from "@worldnest/shared";
import { restoreSavedWorld } from "./savedWorld";
import { createPlayerEntity, type GameBootstrap } from "./playerEntity";

// Restoring the shared world lives in `savedWorld.ts`; re-exported here because
// this module is what `loadSession` and the persistence layer import from.
export type { SavedCrop, SavedStructure, SavedWorldState } from "./savedWorld";

// Assembling player entities lives in `playerEntity.ts`, for the same reason.
// Everything it exports is re-exported here so every existing importer keeps
// working: this module is still the app's single entry point into the wiring.
export type { GameBootstrap } from "./playerEntity";
export {
  LOCAL_PLAYER_ENTITY_ID,
  PLAYER_COLLIDER_SIZE,
  STARTING_WHEAT_SEEDS,
  createPlayerEntity,
  createRemotePlayerEntity,
  remotePlayerEntityId,
} from "./playerEntity";

export interface GameWorldSystems {
  time: TimeSystem;
  input: InputSystem;
  collision: CollisionSystem;
  movement: MovementSystem;
  chunk: ChunkSystem;
  interpolation: InterpolationSystem;
  stats: StatsSystem;
  npc: NpcSystem;
  shop: ShopSystem;
  quest: QuestSystem;
  layer: LayerSystem;
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

  // NPCs own their own occupancy index; composed with the structures below so a
  // villager is as solid as a fence without collision knowing either exists.
  // Starting a conversation is also reported to the quest layer, which is how a
  // `talk` objective is judged — a visit is a moment, not a state to poll.
  const npc = new NpcSystem(
    worldManager,
    (entity) => world.addEntity(entity),
    undefined,
    (npcId) => quest.recordTalk(npcId),
    () => worldManager.getLayer(),
  );

  // Building owns the structure occupancy index, which collision reads as walls.
  // It takes the NPC index as well, so a fence cannot be dropped on a villager.
  const build = new BuildSystem(
    worldManager,
    (entity) => world.addEntity(entity),
    layerGuardedBlockers(() => worldManager.getLayer(), npc),
    setTileOverride,
  );

  // Quests poll the inventory themselves and the structure index through this
  // getter, so no system has to announce anything.
  const quest = new QuestSystem((itemId) => build.countStructures(itemId));
  const layer = new LayerSystem(
    worldManager,
    () => worldManager.getLayer(),
    (nextLayer) => worldManager.setLayer(nextLayer),
  );

  const systems: GameWorldSystems = {
    // The clock runs first so every other system sees the same time this frame
    time: new TimeSystem(),
    input: new InputSystem(),
    // Collision runs between input and movement: it vetoes velocity before it is
    // integrated, which gives per-axis wall sliding for free.
    collision: new CollisionSystem(
      worldManager,
      layerGuardedBlockers(() => worldManager.getLayer(), composeBlockers(build, npc)),
    ),
    movement: new MovementSystem(),
    chunk: new ChunkSystem(worldManager),
    interpolation: new InterpolationSystem(),
    stats: new StatsSystem(() => timeComponent.snapshot.phase),
    // NPCs run before planting so talking to one can never till the ground they
    // are standing on: they consume the interact request first.
    npc,
    // Opening a shop is something a conversation asks for, so it is resolved one
    // system after the conversation itself
    shop: new ShopSystem(),
    // Quests run after both, so a quest taken on in a conversation and a
    // greeting that finishes one both land in the frame they happened
    quest,
    layer,
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
  world.addSystem(systems.shop);
  world.addSystem(systems.quest);
  world.addSystem(systems.layer);
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

  const playerEntity = createPlayerEntity(bootstrap);

  world.addEntity(playerEntity);
  world.addEntity(clockEntity);

  return { world, worldManager, systems, playerEntity, clockEntity };
}

// ECS Core
export { World } from "./ecs/World";
export { Entity } from "./ecs/Entity";
export type { EntityChangeListener } from "./ecs/Entity";
export { Component } from "./ecs/Component";
export { System } from "./ecs/System";

// Components
export {
  PositionComponent,
  VelocityComponent,
  SpriteComponent,
  PlayerComponent,
  ChunkComponent,
  InputComponent,
  NetworkComponent,
  RemoteInterpolationComponent,
  ColliderComponent,
  TimeComponent,
  InventoryComponent,
  StatsComponent,
  InteractionComponent,
} from "./components";
export type { KeyState, InventorySlot } from "./components";

// Inventory operations (pure functions; components stay pure data)
export {
  addItem,
  removeItem,
  countItem,
  hasSpaceFor,
  getSelectedItem,
  selectSlot,
  moveSlot,
} from "./inventory";

// Interaction helpers
export { FACING_OFFSETS, getFacedTile } from "./interaction";
export type { Facing } from "./interaction";

// Systems
export {
  MovementSystem,
  InputSystem,
  ChunkSystem,
  RenderSystem,
  NetworkSyncSystem,
  InterpolationSystem,
  CollisionSystem,
  TimeSystem,
  StatsSystem,
  HarvestSystem,
} from "./systems";
export type {
  RenderData,
  SyncPayload,
  NowFn,
  PhaseGetter,
  SetTileOverride,
} from "./systems";

// World Generation
export {
  ChunkGenerator,
  WorldManager,
  TileType,
  TILE_PROPERTIES,
  TILE_HARVEST_YIELD,
  getTileKey,
  parseTileKey,
  WorldClock,
  PHASE_START_HOURS,
} from "./world";
export type {
  ChunkData,
  ChunkLoadCallback,
  ChunkUnloadCallback,
  TileChangeCallback,
  TileProperties,
  TileHarvestYield,
  TileQuery,
  ClockSnapshot,
  DayPhase,
} from "./world";

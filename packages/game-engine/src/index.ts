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
} from "./systems";
export type { RenderData, SyncPayload, NowFn } from "./systems";

// World Generation
export {
  ChunkGenerator,
  WorldManager,
  TileType,
  TILE_PROPERTIES,
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
  TileQuery,
  ClockSnapshot,
  DayPhase,
} from "./world";

// ECS Core
export { World } from "./ecs/World";
export { Entity } from "./ecs/Entity";
export type { EntityChangeListener } from "./ecs/Entity";
export { Component } from "./ecs/Component";
export { System } from "./ecs/System";
export type { AddEntity, RemoveEntityById } from "./ecs/World";

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
  CropComponent,
  StructureComponent,
  AnimationComponent,
  DEFAULT_FRAME_DURATION_MS,
  DEFAULT_FRAME_COUNT,
} from "./components";
export type { KeyState, InventorySlot, AnimationState } from "./components";

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

// Animation helpers (pure; the system only applies them)
export {
  advanceAnimation,
  directionFromDelta,
  directionalTextureKey,
} from "./animation";

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
  PlantSystem,
  CropGrowthSystem,
  cropEntityId,
  cropStageAt,
  isCropMature,
  BuildSystem,
  structureEntityId,
  AnimationSystem,
} from "./systems";
export type {
  RenderData,
  SyncPayload,
  NowFn,
  PhaseGetter,
  SetTileOverride,
  CropSource,
  MinuteGetter,
} from "./systems";

// World Generation
export {
  ChunkGenerator,
  WorldManager,
  TileType,
  TILE_PROPERTIES,
  TILE_HARVEST_YIELD,
  Biome,
  BIOME_DEFINITIONS,
  classifyBiome,
  CROP_DEFINITIONS,
  isSeed,
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
  BiomeDefinition,
  CropDefinition,
  TileQuery,
  StructureQuery,
  ClockSnapshot,
  DayPhase,
} from "./world";

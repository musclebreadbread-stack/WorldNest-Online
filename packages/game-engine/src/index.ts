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
} from "./components";
export type { KeyState } from "./components";

// Systems
export {
  MovementSystem,
  InputSystem,
  ChunkSystem,
  RenderSystem,
  NetworkSyncSystem,
} from "./systems";
export type { RenderData, SyncPayload } from "./systems";

// World Generation
export { ChunkGenerator, WorldManager, TileType, TILE_PROPERTIES } from "./world";
export type { ChunkData, ChunkLoadCallback, ChunkUnloadCallback, TileProperties } from "./world";

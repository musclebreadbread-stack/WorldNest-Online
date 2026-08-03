// Types
export interface Position {
  x: number;
  y: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  avatar: string;
  level: number;
  health: number;
  maxHealth: number;
}

export interface ChunkData {
  x: number;
  y: number;
  tiles: number[][];
}

export interface WorldConfig {
  seed: number;
  chunkSize: number;
  tileSize: number;
  worldWidth: number;
  worldHeight: number;
}

export type GameEventType =
  "player_move" | "player_join" | "player_leave" | "chat_message" | "world_update";

export interface GameEvent {
  type: GameEventType;
  payload: unknown;
  timestamp: number;
  playerId?: string;
}

// Re-exports
export * from "./chat";
export * from "./constants";
export * from "./economy";
export * from "./items";
export * from "./utils";

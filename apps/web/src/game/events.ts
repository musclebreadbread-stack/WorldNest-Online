/**
 * Event payloads exchanged between the Phaser game and React.
 * Emitted on `game.events` by scenes, consumed by components.
 */

import type { ClockSnapshot } from "@worldnest/game-engine";

export const PLAYERS_CHANGED_EVENT = "players-changed";

export type PlayersChangedEvent =
  | { type: "join"; playerId: string; username: string; x: number; y: number }
  | { type: "leave"; playerId: string }
  | { type: "move"; playerId: string; x: number; y: number };

export const PLAYER_POSITION_EVENT = "player-position";

export interface PlayerPositionEvent {
  x: number;
  y: number;
  chunkX: number;
  chunkY: number;
}

export const CLOCK_CHANGED_EVENT = "clock-changed";

export type ClockChangedEvent = ClockSnapshot;

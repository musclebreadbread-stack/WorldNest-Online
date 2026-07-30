/**
 * Event payloads exchanged between the Phaser game and React.
 * Emitted on `game.events` by scenes, consumed by components.
 */

export const PLAYERS_CHANGED_EVENT = "players-changed";

export type PlayersChangedEvent =
  | { type: "join"; playerId: string; username: string; x: number; y: number }
  | { type: "leave"; playerId: string }
  | { type: "move"; playerId: string; x: number; y: number };

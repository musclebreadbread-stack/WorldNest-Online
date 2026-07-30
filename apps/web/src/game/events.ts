/**
 * Event payloads exchanged between the Phaser game and React.
 * Emitted on `game.events` by scenes, consumed by components.
 */

import type {
  ClockSnapshot,
  DialogueOption,
  InventorySlot,
} from "@worldnest/game-engine";

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

export const INVENTORY_CHANGED_EVENT = "inventory-changed";

export interface InventoryChangedEvent {
  slots: Array<InventorySlot | null>;
  selectedSlot: number;
}

export const STATS_CHANGED_EVENT = "stats-changed";

export interface StatsChangedEvent {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
}

export const DIALOGUE_CHANGED_EVENT = "dialogue-changed";

/**
 * The conversation the player is currently in, or every field empty when none is.
 *
 * Only i18n **keys** cross the bridge (decision D8): the engine owns the dialogue
 * graph, `DialoguePanel` owns the language.
 */
export interface DialogueChangedEvent {
  npcId: string | null;
  nameKey: string | null;
  textKey: string | null;
  options: DialogueOption[];
}

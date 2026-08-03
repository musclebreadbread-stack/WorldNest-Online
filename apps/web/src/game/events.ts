/**
 * Event payloads exchanged between the Phaser game and React.
 * Emitted on `game.events` by scenes, consumed by components.
 */

import type {
  ClockSnapshot,
  DialogueOption,
  InventorySlot,
  QuestEntry,
  Season,
  WeatherKind,
  Biome,
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

export const WALLET_CHANGED_EVENT = "wallet-changed";

/**
 * The local player's coin balance, published whenever it changes.
 *
 * `adjustments` is `WalletComponent`'s counter of how many times the server
 * disagreed with the local balance, so the HUD can say so once per disagreement
 * without polling — the same shape the refusal counters have.
 */
export interface WalletChangedEvent {
  coins: number;
  adjustments: number;
}

export const SHOP_CHANGED_EVENT = "shop-changed";

/**
 * The shop the player has open, or both fields `null` when none is.
 *
 * Like the dialogue event this carries the shopkeeper's i18n **key** rather than
 * their name (decision D8); the panel resolves it.
 */
export interface ShopChangedEvent {
  openNpcId: string | null;
  nameKey: string | null;
}

export const QUESTS_CHANGED_EVENT = "quests-changed";

/**
 * Every quest the player knows about, keyed by quest id.
 *
 * Only the entries cross the bridge: the catalogue itself is static, so the quest
 * log imports `QUEST_DEFINITIONS` and looks up the (translatable) title and
 * description keys for itself.
 */
export interface QuestsChangedEvent {
  entries: Record<string, QuestEntry>;
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

export const ENVIRONMENT_CHANGED_EVENT = "environment-changed";

/**
 * Current season, weather and biome, published whenever the environment
 * component's version bumps. The HUD and weather overlay read this.
 */
export interface EnvironmentChangedEvent {
  season: Season;
  weather: WeatherKind;
  biome: Biome;
  temperature: number;
  energyRegenMultiplier: number;
}

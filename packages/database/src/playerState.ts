import { createSupabaseClient } from "./client";
import type { DbResult, Tables } from "./types";

export type PlayerState = Tables<"player_state">;

/**
 * One persisted inventory slot. `itemId` is deliberately a plain `string`: the
 * column is jsonb, so a row can outlive an item being renamed or removed from
 * the catalogue and the client has to validate it on the way back in.
 */
export interface PersistedInventorySlot {
  itemId: string;
  quantity: number;
}

/**
 * Shape stored in `player_state.inventory`. A type alias rather than an
 * interface so it satisfies the column's `Record<string, unknown>` type.
 */
export type PersistedInventory = {
  slots: Array<PersistedInventorySlot | null>;
  selectedSlot: number;
};

/** The mutable half of a player's saved session. */
export interface PlayerStateSave {
  x: number;
  y: number;
  chunk: string;
  inventory: PersistedInventory;
  /** Coin balance. A column on this row rather than a table of its own (D15). */
  coins: number;
}

/**
 * Load a player's saved position and inventory.
 * Returns `null` data for a player who has never saved, so callers can fall
 * back to the default spawn without inspecting the error.
 */
export async function loadPlayerState(
  playerId: string,
): Promise<DbResult<PlayerState | null>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("player_state")
    .select("*")
    .eq("player_id", playerId)
    .maybeSingle();

  return { data: data ?? null, error: error ? new Error(error.message) : null };
}

/**
 * Write a player's position and inventory, creating the row when absent.
 * `last_online` is refreshed on every save so it doubles as a "seen at" stamp.
 */
export async function savePlayerState(
  playerId: string,
  state: PlayerStateSave,
): Promise<DbResult<null>> {
  const client = createSupabaseClient();
  const { error } = await client.from("player_state").upsert({
    player_id: playerId,
    x: state.x,
    y: state.y,
    chunk: state.chunk,
    inventory: state.inventory,
    coins: state.coins,
    last_online: new Date().toISOString(),
  });

  return { data: null, error: error ? new Error(error.message) : null };
}

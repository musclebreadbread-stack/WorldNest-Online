import {
  getDefaultWorld,
  loadCrops,
  loadPlayerState,
  loadQuests,
  loadStructures,
  loadWorldModifications,
} from "@worldnest/database";
import type { PersistedInventory } from "@worldnest/database";
import { getTileKey } from "@worldnest/game-engine";
import type { QuestEntry, TileType } from "@worldnest/game-engine";
import { isItemId } from "@worldnest/shared";
import { parsePersistedInventory } from "../lib/inventorySnapshot";
import { parsePersistedQuests } from "../lib/questSnapshot";
import type { SavedCrop, SavedStructure, SavedWorldState } from "./createGameWorld";

/** Everything a session needs from the database before the game boots. */
export interface SessionSnapshot {
  worldId: string;
  spawnX: number | null;
  spawnY: number | null;
  inventory: PersistedInventory | null;
  /**
   * The authoritative balance from `player_state.coins`, or `null` when there is
   * no row at all — which is the only case left where the client grants the
   * starting purse itself, and it is also the no-backend case.
   */
  coins: number | null;
  quests: Record<string, QuestEntry> | null;
  savedWorld: SavedWorldState;
}

/**
 * Load the shared world plus this player's saved state.
 *
 * Returns `null` whenever the data is unavailable — Supabase unconfigured, the
 * migrations not run, no signed-in user — so the caller can boot with the
 * default spawn and starting kit. This mirrors `AuthProvider`'s tolerance
 * pattern: a missing backend degrades the game, it does not break it.
 */
export async function loadSession(
  playerId: string | null,
): Promise<SessionSnapshot | null> {
  if (!playerId) return null;

  try {
    const { data: world } = await getDefaultWorld();
    if (!world) return null;

    const [playerState, quests, modifications, structures, crops] = await Promise.all([
      loadPlayerState(playerId),
      loadQuests(playerId),
      loadWorldModifications(world.id),
      loadStructures(world.id),
      loadCrops(world.id),
    ]);

    // The provisioning trigger inserts (0, 0), which is not a playable spawn, so
    // the column default is treated the same as a missing row.
    const saved = playerState.data;
    const hasSpawn = saved !== null && (saved.x !== 0 || saved.y !== 0);

    return {
      worldId: world.id,
      spawnX: hasSpawn ? saved.x : null,
      spawnY: hasSpawn ? saved.y : null,
      inventory: parsePersistedInventory(saved?.inventory),
      // The column is authoritative and its default is the starting purse
      // (decision D5), so the row is simply trusted. The old "judge coins from
      // the whole row, not the column" rule existed because the client granted
      // itself the purse; it cannot any more, so the special case is gone.
      coins: saved?.coins ?? null,
      quests: parsePersistedQuests(quests.data),
      savedWorld: {
        tileOverrides: modifications.data.map<[string, TileType]>((row) => [
          getTileKey(row.tile_x, row.tile_y),
          row.tile_type as TileType,
        ]),
        structures: structures.data.filter(isSavedItem).map(toSavedStructure),
        crops: crops.data.filter(isSavedItem).map(toSavedCrop),
      },
    };
  } catch {
    // Supabase not configured or unreachable - play without persistence
    return null;
  }
}

/** Rows whose `item_id` is no longer in the catalogue are dropped, not restored. */
function isSavedItem(row: { item_id: string }): boolean {
  return isItemId(row.item_id);
}

function toSavedStructure(row: {
  item_id: string;
  tile_x: number;
  tile_y: number;
}): SavedStructure {
  return {
    itemId: row.item_id as SavedStructure["itemId"],
    tileX: row.tile_x,
    tileY: row.tile_y,
  };
}

function toSavedCrop(row: {
  item_id: string;
  tile_x: number;
  tile_y: number;
  planted_at_minute: number;
}): SavedCrop {
  return { ...toSavedStructure(row), plantedAtMinute: row.planted_at_minute };
}

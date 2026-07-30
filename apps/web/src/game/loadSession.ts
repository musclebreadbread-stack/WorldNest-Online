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
  /** `null` for a player who has never saved, so the starting purse is granted. */
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
    const inventory = parsePersistedInventory(saved?.inventory);
    // Coins are judged from the row as a whole, not from the column: 0 is a
    // balance a player can genuinely reach, so it only means "never saved" when
    // the rest of the row is untouched too.
    const hasSaved = hasSpawn || inventory !== null;

    return {
      worldId: world.id,
      spawnX: hasSpawn ? saved.x : null,
      spawnY: hasSpawn ? saved.y : null,
      inventory,
      coins: hasSaved ? saved!.coins : null,
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

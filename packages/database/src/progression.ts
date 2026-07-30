import { createSupabaseClient } from "./client";
import type { DbResult, Tables } from "./types";

export type PlayerQuest = Tables<"player_quests">;

/**
 * One persisted quest. `questId` and `state` are plain strings on purpose: the
 * quest catalogue lives in the client, so a row can outlive a quest being
 * renamed or dropped and the client validates it on the way back in — the same
 * contract `player_state.inventory` has.
 */
export interface PersistedQuest {
  questId: string;
  state: string;
  progress: number;
}

/**
 * Load a player's whole quest log.
 * Returns an empty array for a player who has never taken a quest, so callers
 * never have to tell "no rows" from "no backend".
 */
export async function loadQuests(playerId: string): Promise<DbResult<PersistedQuest[]>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("player_quests")
    .select("*")
    .eq("player_id", playerId);

  return {
    data: (data ?? []).map((row) => ({
      questId: row.quest_id,
      state: row.state,
      progress: row.progress,
    })),
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Write one quest's state, creating the row when absent.
 * Upserts on the composite primary key, so a quest is stored once per player and
 * its progress is overwritten rather than appended to.
 */
export async function saveQuest(
  playerId: string,
  quest: PersistedQuest,
): Promise<DbResult<null>> {
  const client = createSupabaseClient();
  const { error } = await client.from("player_quests").upsert(
    {
      player_id: playerId,
      quest_id: quest.questId,
      state: quest.state,
      progress: quest.progress,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "player_id,quest_id" },
  );

  return { data: null, error: error ? new Error(error.message) : null };
}

/**
 * Write a whole quest log. Rows are independent, so the writes go out together
 * and the first error is reported; a partial log is better than none, and the
 * next autosave retries.
 */
export async function saveQuests(
  playerId: string,
  quests: PersistedQuest[],
): Promise<DbResult<null>> {
  const results = await Promise.all(
    quests.map((quest) => saveQuest(playerId, quest)),
  );

  return {
    data: null,
    error: results.find((result) => result.error !== null)?.error ?? null,
  };
}

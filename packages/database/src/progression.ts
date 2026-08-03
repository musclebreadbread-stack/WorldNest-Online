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
  /** Read-only from the client's side; see `saveQuest`. */
  state: string;
  progress: number;
  /** Structure count captured when a build objective is accepted. */
  baseline: number;
}

/**
 * Load a player's whole quest log.
 * Returns an empty array for a player who has never taken a quest, so callers
 * never have to tell "no rows" from "no backend".
 */
export async function loadQuests(
  playerId: string,
): Promise<DbResult<PersistedQuest[]>> {
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
      baseline: row.baseline,
    })),
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Write one quest's progress, creating the row when absent.
 * Upserts on the composite primary key, so a quest is stored once per player and
 * its progress is overwritten rather than appended to.
 *
 * `state` is read back but never sent: migration 004 grants every column on this
 * table except that one, so a new row becomes `'active'` from the column default
 * and only `claimQuestReward` can ever move it to `'completed'` (decision D3).
 * A statement naming `state` is refused outright, which would lose the progress
 * with it.
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
      progress: quest.progress,
      baseline: quest.baseline,
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
  const results = await Promise.all(quests.map((quest) => saveQuest(playerId, quest)));

  return {
    data: null,
    error: results.find((result) => result.error !== null)?.error ?? null,
  };
}

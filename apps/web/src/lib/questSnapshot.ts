import { getQuest } from "@worldnest/game-engine";
import type { QuestComponent, QuestEntry, QuestState } from "@worldnest/game-engine";
import type { PersistedQuest } from "@worldnest/database";

/** The three states `player_quests.state`'s check constraint allows. */
const QUEST_STATES: QuestState[] = ["available", "active", "completed"];

/**
 * Convert the live quest log into the rows stored in `player_quests`.
 * One row per quest the player has been offered; a player who has taken none
 * writes nothing, which is exactly what an untouched save looks like.
 */
export function toPersistedQuests(quest: QuestComponent): PersistedQuest[] {
  return Object.entries(quest.entries).map(([questId, entry]) => ({
    questId,
    state: entry.state,
    progress: entry.progress,
    baseline: 0,
  }));
}

/**
 * Validate saved quest rows.
 *
 * Returns `null` when there is nothing usable to restore — no rows at all, or
 * only rows the catalogue no longer knows — which is the signal to start with an
 * empty log rather than to restore one. A quest that has been removed from the
 * game drops its row instead of crashing the session, the same guarantee
 * `isItemId` gives persisted inventory slots.
 */
export function parsePersistedQuests(
  rows: readonly PersistedQuest[] | null | undefined,
): Record<string, QuestEntry> | null {
  if (!rows || rows.length === 0) return null;

  const entries: Record<string, QuestEntry> = {};
  for (const row of rows) {
    const entry = parseEntry(row);
    if (entry) entries[row.questId] = entry;
  }

  return Object.keys(entries).length > 0 ? entries : null;
}

/**
 * Overwrite a quest log with saved entries.
 * Replaces rather than merges, so a returning player cannot end up with a quest
 * twice, and bumps `version` because the HUD publishes on that.
 */
export function restoreQuests(
  quest: QuestComponent,
  entries: Record<string, QuestEntry>,
): void {
  quest.entries = { ...entries };
  quest.version += 1;
}

function parseEntry(row: PersistedQuest): QuestEntry | null {
  if (!getQuest(row.questId)) return null;
  if (!isQuestState(row.state)) return null;
  if (typeof row.progress !== "number" || !Number.isFinite(row.progress)) return null;

  return { state: row.state, progress: Math.max(0, Math.floor(row.progress)) };
}

function isQuestState(state: string): state is QuestState {
  return (QUEST_STATES as string[]).includes(state);
}

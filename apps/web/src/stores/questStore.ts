import { create } from "zustand";
import { QUEST_IDS, type QuestEntry } from "@worldnest/game-engine";
import type { QuestsChangedEvent } from "../game/events";

/** Takes a quest on, or hands one in. Injected by `QuestBridge` once the game boots. */
export type QuestRequest = (questId: string) => void;

/** One quest as the HUD sees it: the catalogue id plus the player's own state. */
export interface TrackedQuest {
  questId: string;
  entry: QuestEntry;
}

interface QuestState {
  /** Every quest the player knows about, keyed by quest id. */
  entries: Record<string, QuestEntry>;
  accepter: QuestRequest | null;
  turnerIn: QuestRequest | null;

  setSnapshot: (snapshot: QuestsChangedEvent) => void;
  setCallbacks: (accepter: QuestRequest | null, turnerIn: QuestRequest | null) => void;
  accept: (questId: string) => void;
  turnIn: (questId: string) => void;
}

/**
 * The quest log the HUD is showing, mirrored from the engine.
 *
 * Same shape as `dialogueStore` and `shopStore` (decision D13): the panel calls
 * an injected callback that raises a request on the player's `QuestComponent`, and
 * `QuestSystem` applies it next frame. React never marks a quest complete itself,
 * which is what stops the log from claiming a reward the engine refused.
 */
export const useQuestStore = create<QuestState>((set, get) => ({
  entries: {},
  accepter: null,
  turnerIn: null,

  setSnapshot: (snapshot) => set({ entries: snapshot.entries }),

  setCallbacks: (accepter, turnerIn) => set({ accepter, turnerIn }),

  // Wrapped rather than exposed raw so no caller has to null-check: before the
  // game has booted, both are no-ops.
  accept: (questId) => get().accepter?.(questId),

  turnIn: (questId) => get().turnerIn?.(questId),
}));

/**
 * Every known quest in catalogue order, so the log does not reshuffle itself when
 * a quest changes state.
 */
export function orderedQuests(entries: Record<string, QuestEntry>): TrackedQuest[] {
  return QUEST_IDS.filter((questId) => entries[questId] !== undefined).map(
    (questId) => ({ questId, entry: entries[questId] }),
  );
}

/**
 * The quest the tracker shows: the first active one in catalogue order, or `null`
 * when nothing is being worked on. One line of HUD is enough for one job.
 */
export function trackedQuest(entries: Record<string, QuestEntry>): TrackedQuest | null {
  return orderedQuests(entries).find(({ entry }) => entry.state === "active") ?? null;
}

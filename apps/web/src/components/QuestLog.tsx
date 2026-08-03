"use client";

import { AnimatePresence, motion } from "framer-motion";
import { QUEST_DEFINITIONS, objectiveTarget } from "@worldnest/game-engine";
import type { QuestEntry, QuestState } from "@worldnest/game-engine";
import { Card } from "@worldnest/ui";
import type { MessageKey } from "../i18n";
import { isMessageKey } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import type { TranslateFn } from "../i18n/useTranslation";
import { orderedQuests, useQuestStore } from "../stores/questStore";
import { useUIStore } from "../stores/uiStore";

/** State badge per quest state, as a record so a new state fails to compile. */
const STATE_KEYS: Record<QuestState, MessageKey> = {
  available: "quest.state.available",
  active: "quest.state.active",
  completed: "quest.state.completed",
};

/**
 * The quest log, toggled with `J`.
 *
 * Titles and descriptions arrive from the engine as i18n keys (decision D8), so
 * the same three quests read naturally in twelve languages. Handing one in calls
 * the store's injected `turnIn`, which raises a request the engine consumes next
 * frame — the button never marks anything complete by itself.
 */
export function QuestLog() {
  const questLogOpen = useUIStore((s) => s.questLogOpen);
  const setQuestLogOpen = useUIStore((s) => s.setQuestLogOpen);
  const entries = useQuestStore((s) => s.entries);
  const turnIn = useQuestStore((s) => s.turnIn);
  const { t } = useTranslation();

  const quests = orderedQuests(entries);

  return (
    <AnimatePresence>
      {questLogOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <Card className="w-[22rem] max-w-[92vw] border-white/10 bg-gray-900/95">
            <h3 className="mb-3 text-lg font-semibold text-white">
              {t("quest.title")}
            </h3>

            {quests.length === 0 ? (
              <p className="text-xs text-gray-400">{t("quest.empty")}</p>
            ) : (
              <ul className="max-h-[50vh] space-y-3 overflow-y-auto">
                {quests.map(({ questId, entry }) => (
                  <QuestRow
                    key={questId}
                    questId={questId}
                    entry={entry}
                    onTurnIn={() => turnIn(questId)}
                  />
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setQuestLogOpen(false)}
              className="mt-4 w-full rounded bg-white/10 py-1 text-xs text-white hover:bg-white/20"
            >
              {t("quest.close")}
            </button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface QuestRowProps {
  questId: string;
  entry: QuestEntry;
  onTurnIn: () => void;
}

/** One quest: what it asks for, how far along it is, and how to hand it in. */
function QuestRow({ questId, entry, onTurnIn }: QuestRowProps) {
  const { t } = useTranslation();
  const definition = QUEST_DEFINITIONS[questId];
  if (!definition) return null;

  const target = objectiveTarget(definition.objective);
  const finishable = entry.state === "active" && entry.progress >= target;

  return (
    <li className="rounded bg-white/5 p-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium text-white">
          {resolve(t, definition.titleKey)}
        </h4>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-gray-400">
          {t(STATE_KEYS[entry.state])}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-300">
        {resolve(t, definition.descriptionKey)}
      </p>
      <p className="hud-numeric mt-1 text-[10px] text-gray-400">
        {t("quest.progress", { current: entry.progress, target })}
      </p>

      {finishable && (
        <button
          type="button"
          onClick={onTurnIn}
          className="mt-2 w-full rounded bg-emerald-500/80 py-1 text-[10px] text-black hover:bg-emerald-400"
        >
          {t("quest.turnIn")}
        </button>
      )}
    </li>
  );
}

/**
 * Translate a key that came from the engine. Quest titles are stored as keys
 * (decision D8) and are shown verbatim if the catalogue has never heard of them.
 */
function resolve(t: TranslateFn, key: string): string {
  return isMessageKey(key) ? t(key) : key;
}

"use client";

import { QUEST_DEFINITIONS, objectiveTarget } from "@worldnest/game-engine";
import { isMessageKey } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import { trackedQuest, useQuestStore } from "../stores/questStore";

/**
 * The job in hand, shown under the clock.
 *
 * One line only: the first active quest, its title and its progress. Everything
 * else lives in the quest log (`J`), because a HUD that lists three quests at once
 * is a HUD nobody reads.
 */
export function QuestTracker() {
  const entries = useQuestStore((s) => s.entries);
  const { t } = useTranslation();

  const tracked = trackedQuest(entries);
  if (!tracked) return null;

  const definition = QUEST_DEFINITIONS[tracked.questId];
  if (!definition) return null;

  const target = objectiveTarget(definition.objective);
  const titleKey = definition.titleKey;

  return (
    <div className="rounded bg-black/70 px-3 py-1 text-xs text-white">
      <span className="text-[10px] uppercase tracking-wide text-gray-400">
        {t("quest.tracking")}
      </span>
      <span className="ms-2">{isMessageKey(titleKey) ? t(titleKey) : titleKey}</span>
      <span className="hud-numeric ms-2 text-gray-300">
        {t("quest.progress", { current: tracked.entry.progress, target })}
      </span>
    </div>
  );
}

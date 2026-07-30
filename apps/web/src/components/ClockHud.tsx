"use client";

import { CLOCK_PHASE_KEYS } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import { useUIStore } from "../stores/uiStore";
import { formatTime } from "../lib/formatClock";

/**
 * Top-centre readout of the shared world clock, e.g. `Day 3 · 07:20 · dawn`.
 *
 * The day counter and the phase name are translated and composed through the
 * `clock.format` message, because their order differs between locales; only the
 * `HH:MM` part is formatted in code.
 *
 * Renders nothing until the game emits its first clock snapshot.
 */
export function ClockHud() {
  const clock = useUIStore((s) => s.clock);
  const { t } = useTranslation();
  if (!clock) return null;

  return (
    <div className="rounded bg-black/70 px-3 py-2 font-mono text-sm text-white">
      {t("clock.format", {
        day: clock.day,
        time: formatTime(clock),
        phase: t(CLOCK_PHASE_KEYS[clock.phase]),
      })}
    </div>
  );
}

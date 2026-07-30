"use client";

import { useUIStore } from "../stores/uiStore";
import { formatClock } from "../lib/formatClock";

/**
 * Top-centre readout of the shared world clock, e.g. `Day 3 · 07:20 · dawn`.
 * Renders nothing until the game emits its first clock snapshot.
 */
export function ClockHud() {
  const clock = useUIStore((s) => s.clock);
  if (!clock) return null;

  return (
    <div className="rounded bg-black/70 px-3 py-2 font-mono text-sm text-white">
      {formatClock(clock)}
    </div>
  );
}

"use client";

import { useGameStore } from "../stores/gameStore";

interface BarProps {
  label: string;
  value: number;
  max: number;
  /** Tailwind background class for the filled portion. */
  colorClass: string;
}

function Bar({ label, value, max, colorClass }: BarProps) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-[10px] uppercase tracking-wide text-gray-300">
        {label}
      </span>
      <div className="h-2.5 w-32 overflow-hidden rounded-full bg-white/20">
        <div className={`h-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="w-14 text-right font-mono text-[10px] text-gray-200">
        {Math.round(value)}/{max}
      </span>
    </div>
  );
}

/**
 * Health and energy bars for the local player, fed by the `stats-changed` event.
 * Energy is what harvesting and (later) planting and building spend.
 */
export function StatusBars() {
  const { health, maxHealth, energy, maxEnergy } = useGameStore();

  return (
    <div className="flex flex-col gap-1 rounded bg-black/70 px-3 py-2">
      <Bar label="HP" value={health} max={maxHealth} colorClass="bg-red-500" />
      <Bar label="EN" value={energy} max={maxEnergy} colorClass="bg-amber-400" />
    </div>
  );
}

"use client";

import { useTranslation } from "../i18n/useTranslation";
import { useGameStore } from "../stores/gameStore";

/**
 * The coin purse, in the top-right HUD stack.
 *
 * The number carries `hud-numeric` for the same reason the coordinates do: in
 * Arabic the bidi algorithm would otherwise move the digits to the wrong side of
 * the word.
 */
export function CoinCounter() {
  const coins = useGameStore((s) => s.coins);
  const { t } = useTranslation();

  return (
    <div className="rounded bg-black/70 px-3 py-2 text-sm text-amber-200">
      <span className="hud-numeric">{t("hud.coins", { count: coins })}</span>
    </div>
  );
}

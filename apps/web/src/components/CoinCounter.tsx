"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../i18n/useTranslation";
import { useGameStore } from "../stores/gameStore";

/** How long the "the server corrected this" note stays up, in milliseconds. */
export const COINS_ADJUSTED_NOTICE_MS = 4000;

/**
 * The coin purse, in the top-right HUD stack.
 *
 * The number carries `hud-numeric` for the same reason the coordinates do: in
 * Arabic the bidi algorithm would otherwise move the digits to the wrong side of
 * the word.
 *
 * Coins are the one thing the server has the last word on, so when it corrects
 * the balance the player is told — once per correction, and briefly. A permanent
 * badge would read as an error the player has to do something about, and this is
 * not one: an honest client's balance is corrected the moment it lags behind a
 * trade, which is routine.
 */
export function CoinCounter() {
  const coins = useGameStore((s) => s.coins);
  const adjustments = useGameStore((s) => s.coinAdjustments);
  const { t } = useTranslation();
  const [adjusted, setAdjusted] = useState(false);
  const seen = useRef(adjustments);

  useEffect(() => {
    if (adjustments === seen.current) return;

    seen.current = adjustments;
    setAdjusted(true);
    const timer = setTimeout(() => setAdjusted(false), COINS_ADJUSTED_NOTICE_MS);
    return () => clearTimeout(timer);
  }, [adjustments]);

  return (
    <div className="rounded bg-black/70 px-3 py-2 text-sm text-amber-200">
      <span className="hud-numeric">{t("hud.coins", { count: coins })}</span>
      {adjusted && (
        <span className="ms-2 text-[10px] text-gray-400">{t("hud.coinsAdjusted")}</span>
      )}
    </div>
  );
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { InventorySlot, ShopTradeKind } from "@worldnest/game-engine";
import { ITEM_PRICES, TRADABLE_ITEM_IDS, type ItemId } from "@worldnest/shared";
import { Card } from "@worldnest/ui";
import { ITEM_NAME_KEYS, isMessageKey } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";
import type { TranslateFn } from "../i18n/useTranslation";
import { useGameStore } from "../stores/gameStore";
import { useShopStore } from "../stores/shopStore";

/** Trade sizes offered. Two buttons per direction keeps the panel readable. */
const QUANTITIES = [1, 10] as const;

/**
 * The NPC shop, opened from a shopkeeper's dialogue.
 *
 * Prices come straight from `ITEM_PRICES` and never change, so there is nothing
 * random to show and nothing to gamble on (decision D14) — and because the sell
 * price is always below the buy price, no row can be used as a money loop.
 *
 * A click calls the store's injected `trade`, which raises a request the engine
 * consumes next frame (decision D13). The button is disabled when the coins are
 * not there or the items are not held, so the common refusals never happen; the
 * engine still checks both, and also refuses when the backpack is full.
 */
export function ShopPanel() {
  const openNpcId = useShopStore((s) => s.openNpcId);
  const nameKey = useShopStore((s) => s.nameKey);
  const trade = useShopStore((s) => s.trade);
  const close = useShopStore((s) => s.close);
  const coins = useGameStore((s) => s.coins);
  const inventorySlots = useGameStore((s) => s.inventorySlots);
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {openNpcId !== null && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          <Card className="w-[26rem] max-w-[92vw] border-white/10 bg-gray-900/95">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">
                {nameKey ? resolve(t, nameKey) : t("shop.title")}
              </h3>
              <span className="hud-numeric text-xs text-amber-200">
                {t("hud.coins", { count: coins })}
              </span>
            </div>
            <p className="mb-3 text-[10px] text-gray-400">{t("shop.hint")}</p>

            <div className="flex items-center gap-2 border-b border-white/10 pb-1 text-[10px] uppercase tracking-wide text-gray-400">
              <span className="flex-1 text-start">{t("shop.item")}</span>
              <span className="w-24 text-center">{t("shop.buy")}</span>
              <span className="w-24 text-center">{t("shop.sell")}</span>
            </div>

            <ul className="max-h-[50vh] space-y-1 overflow-y-auto pt-1">
              {TRADABLE_ITEM_IDS.map((itemId) => (
                <TradeRow
                  key={itemId}
                  itemId={itemId}
                  held={countHeld(inventorySlots, itemId)}
                  coins={coins}
                  onTrade={trade}
                />
              ))}
            </ul>

            <button
              type="button"
              onClick={close}
              className="mt-3 w-full rounded bg-white/10 py-1 text-xs text-white hover:bg-white/20"
            >
              {t("shop.close")}
            </button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface TradeRowProps {
  itemId: ItemId;
  held: number;
  coins: number;
  onTrade: (kind: ShopTradeKind, itemId: ItemId, quantity: number) => void;
}

/** One item: its name, how many are held, and the four trade buttons. */
function TradeRow({ itemId, held, coins, onTrade }: TradeRowProps) {
  const { t } = useTranslation();
  const price = ITEM_PRICES[itemId]!;
  const name = t(ITEM_NAME_KEYS[itemId]);

  return (
    <li className="flex items-center gap-2 text-xs text-white">
      <span className="flex-1 text-start">
        {name}
        <span className="hud-numeric ms-1 text-[10px] text-gray-400">
          {t("shop.held", { count: held })}
        </span>
      </span>

      <span className="flex w-24 justify-center gap-1">
        {QUANTITIES.map((quantity) => (
          <TradeButton
            key={quantity}
            name={name}
            label={t("shop.buyQuantity", { quantity })}
            title={t("shop.buyPrice", { coins: price.buy * quantity })}
            disabled={coins < price.buy * quantity}
            onClick={() => onTrade("buy", itemId, quantity)}
          />
        ))}
      </span>

      <span className="flex w-24 justify-center gap-1">
        {QUANTITIES.map((quantity) => (
          <TradeButton
            key={quantity}
            name={name}
            label={t("shop.sellQuantity", { quantity })}
            title={t("shop.sellPrice", { coins: price.sell * quantity })}
            disabled={held < quantity}
            onClick={() => onTrade("sell", itemId, quantity)}
          />
        ))}
      </span>
    </li>
  );
}

interface TradeButtonProps {
  /** Item being traded; part of the label so a screen reader names it. */
  name: string;
  label: string;
  title: string;
  disabled: boolean;
  onClick: () => void;
}

function TradeButton({ name, label, title, disabled, onClick }: TradeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={`${name} · ${label} · ${title}`}
      className="hud-numeric rounded bg-white/10 px-2 py-1 text-[10px] text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {label}
    </button>
  );
}

/** How many of an item the inventory mirror is holding. */
function countHeld(slots: Array<InventorySlot | null>, itemId: ItemId): number {
  return slots.reduce(
    (total, slot) => (slot && slot.itemId === itemId ? total + slot.quantity : total),
    0,
  );
}

/**
 * Translate a key that came from the engine. The shopkeeper's name arrives as an
 * i18n key (decision D8) and is shown verbatim if the catalogue lacks it.
 */
function resolve(t: TranslateFn, key: string): string {
  return isMessageKey(key) ? t(key) : key;
}

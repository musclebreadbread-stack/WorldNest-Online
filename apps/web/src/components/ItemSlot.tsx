"use client";

import type { InventorySlot } from "@worldnest/game-engine";
import { ITEM_NAME_KEYS } from "../i18n";
import { useTranslation } from "../i18n/useTranslation";

export interface ItemSlotProps {
  slot: InventorySlot | null;
  selected?: boolean;
  /** Optional hotkey number rendered in the corner. */
  hotkey?: number;
}

/**
 * One inventory cell, shared by the hotbar and the inventory panel so both stay
 * visually identical.
 *
 * The item name comes from the message catalogue rather than
 * `ITEM_DEFINITIONS[id].displayName`: the definition's name is the English
 * developer-facing label, and the HUD needs the player's language.
 */
export function ItemSlot({ slot, selected = false, hotkey }: ItemSlotProps) {
  const { t } = useTranslation();
  const name = slot ? t(ITEM_NAME_KEYS[slot.itemId]) : undefined;

  return (
    <div
      className={`relative flex h-14 w-14 flex-col items-center justify-center rounded border-2 bg-black/70 text-white ${
        selected ? "border-amber-300" : "border-white/20"
      }`}
      title={name}
    >
      {hotkey !== undefined && (
        <span className="hud-numeric absolute start-1 top-0.5 text-[10px] text-gray-400">
          {hotkey}
        </span>
      )}
      {slot && (
        <>
          <span className="px-1 text-center text-[10px] leading-tight">{name}</span>
          <span className="hud-numeric absolute bottom-0.5 end-1 text-[10px] font-bold">
            {slot.quantity}
          </span>
        </>
      )}
    </div>
  );
}

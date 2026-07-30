"use client";

import type { InventorySlot } from "@worldnest/game-engine";
import { ITEM_DEFINITIONS } from "@worldnest/shared";

export interface ItemSlotProps {
  slot: InventorySlot | null;
  selected?: boolean;
  /** Optional hotkey number rendered in the corner. */
  hotkey?: number;
}

/**
 * One inventory cell, shared by the hotbar and the inventory panel so both stay
 * visually identical.
 */
export function ItemSlot({ slot, selected = false, hotkey }: ItemSlotProps) {
  const definition = slot ? ITEM_DEFINITIONS[slot.itemId] : null;

  return (
    <div
      className={`relative flex h-14 w-14 flex-col items-center justify-center rounded border-2 bg-black/70 text-white ${
        selected ? "border-amber-300" : "border-white/20"
      }`}
      title={definition?.displayName}
    >
      {hotkey !== undefined && (
        <span className="absolute left-1 top-0.5 text-[10px] text-gray-400">
          {hotkey}
        </span>
      )}
      {definition && (
        <>
          <span className="px-1 text-center text-[10px] leading-tight">
            {definition.displayName}
          </span>
          <span className="absolute bottom-0.5 right-1 text-[10px] font-bold">
            {slot!.quantity}
          </span>
        </>
      )}
    </div>
  );
}

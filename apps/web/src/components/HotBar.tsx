"use client";

import { HOTBAR_SLOTS } from "@worldnest/shared";
import { useGameStore } from "../stores/gameStore";
import { ItemSlot } from "./ItemSlot";

/**
 * The first `HOTBAR_SLOTS` inventory slots, selectable with the number keys.
 */
export function HotBar() {
  const inventorySlots = useGameStore((s) => s.inventorySlots);
  const selectedSlot = useGameStore((s) => s.selectedSlot);

  return (
    <div className="flex gap-1">
      {Array.from({ length: HOTBAR_SLOTS }, (_, index) => (
        <ItemSlot
          key={index}
          slot={inventorySlots[index] ?? null}
          selected={index === selectedSlot}
          hotkey={index + 1}
        />
      ))}
    </div>
  );
}

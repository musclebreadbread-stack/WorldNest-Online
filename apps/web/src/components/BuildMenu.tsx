"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@worldnest/ui";
import {
  HOTBAR_SLOTS,
  ITEM_DEFINITIONS,
  isPlaceableStructure,
} from "@worldnest/shared";
import { useGameStore } from "../stores/gameStore";
import { useUIStore } from "../stores/uiStore";

/**
 * Build mode helper, toggled with `B`.
 *
 * Read-only on purpose: the engine's inventory owns the selection, so the menu
 * lists which hotbar slots hold something placeable and leaves selecting to the
 * number keys instead of risking a store/engine mismatch.
 */
export function BuildMenu() {
  const buildMode = useUIStore((s) => s.buildMode);
  const inventorySlots = useGameStore((s) => s.inventorySlots);
  const selectedSlot = useGameStore((s) => s.selectedSlot);

  const placeable = inventorySlots
    .slice(0, HOTBAR_SLOTS)
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => slot !== null && isPlaceableStructure(slot.itemId));

  return (
    <AnimatePresence>
      {buildMode && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.15 }}
        >
          <Card className="w-52 border-white/10 bg-gray-900/95">
            <h3 className="mb-2 text-sm font-semibold text-white">Build mode</h3>

            {placeable.length === 0 ? (
              <p className="text-xs text-gray-400">No placeable items in the hotbar.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {placeable.map(({ slot, index }) => (
                  <li
                    key={index}
                    className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                      index === selectedSlot
                        ? "bg-amber-300/20 text-amber-200"
                        : "text-gray-300"
                    }`}
                  >
                    <span>
                      {index + 1}. {ITEM_DEFINITIONS[slot!.itemId].displayName}
                    </span>
                    <span className="font-bold">{slot!.quantity}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-2 text-[10px] leading-tight text-gray-400">
              Q or click places on the faced tile · B exits
            </p>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

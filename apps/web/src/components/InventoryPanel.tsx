"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@worldnest/ui";
import { useGameStore } from "../stores/gameStore";
import { useUIStore } from "../stores/uiStore";
import { ItemSlot } from "./ItemSlot";

const COLUMNS = 5;

/**
 * Full inventory grid, toggled with the `I` key.
 */
export function InventoryPanel() {
  const inventoryOpen = useUIStore((s) => s.inventoryOpen);
  const setInventoryOpen = useUIStore((s) => s.setInventoryOpen);
  const inventorySlots = useGameStore((s) => s.inventorySlots);
  const selectedSlot = useGameStore((s) => s.selectedSlot);

  return (
    <AnimatePresence>
      {inventoryOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
        >
          {/* Card's own title is styled for light backgrounds, so the heading
              is rendered as a child instead. */}
          <Card className="border-white/10 bg-gray-900/95">
            <h3 className="mb-4 text-lg font-semibold text-white">Inventory</h3>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}
            >
              {inventorySlots.map((slot, index) => (
                <ItemSlot key={index} slot={slot} selected={index === selectedSlot} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setInventoryOpen(false)}
              className="mt-4 w-full rounded bg-white/10 py-1 text-xs text-white hover:bg-white/20"
            >
              Close (I)
            </button>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

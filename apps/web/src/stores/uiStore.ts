import { create } from "zustand";
import type { ClockSnapshot } from "@worldnest/game-engine";

interface UIState {
  /** Latest world clock snapshot, or `null` before the game has booted. */
  clock: ClockSnapshot | null;
  inventoryOpen: boolean;
  /** Build mode shows the placement ghost and enables `Q` / left-click placing. */
  buildMode: boolean;

  setClock: (clock: ClockSnapshot) => void;
  setInventoryOpen: (inventoryOpen: boolean) => void;
  toggleInventory: () => void;
  setBuildMode: (buildMode: boolean) => void;
  toggleBuildMode: () => void;
}

/**
 * HUD-only state that the game pushes into React. Kept separate from `gameStore`
 * so purely presentational toggles never re-render simulation consumers.
 */
export const useUIStore = create<UIState>((set) => ({
  clock: null,
  inventoryOpen: false,
  buildMode: false,

  setClock: (clock) => set({ clock }),

  setInventoryOpen: (inventoryOpen) => set({ inventoryOpen }),

  toggleInventory: () => set((state) => ({ inventoryOpen: !state.inventoryOpen })),

  setBuildMode: (buildMode) => set({ buildMode }),

  toggleBuildMode: () => set((state) => ({ buildMode: !state.buildMode })),
}));

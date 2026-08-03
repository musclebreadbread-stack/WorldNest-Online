import { create } from "zustand";
import type { CraftingStation, CraftingMachineState } from "@worldnest/game-engine";

interface CraftingStoreState {
  /** Current crafting state mirrored from CraftingComponent. */
  craftingState: CraftingMachineState;
  /** Currently selected recipe id. */
  selectedRecipe: string | null;
  /** Timer progress in ms. */
  timer: number;
  /** Current station the player has access to. */
  station: CraftingStation;
  /** Whether the crafting panel is open. */
  panelOpen: boolean;
  /** Version counter from CraftingComponent for change detection. */
  version: number;

  setCraftingState: (
    state: CraftingMachineState,
    recipe: string | null,
    timer: number,
    station: CraftingStation,
    version: number,
  ) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
}

/**
 * Zustand store bridging the CraftingComponent state to the React UI.
 * The game loop pushes state here on version changes.
 */
export const useCraftingStore = create<CraftingStoreState>((set) => ({
  craftingState: "idle",
  selectedRecipe: null,
  timer: 0,
  station: "hand",
  panelOpen: false,
  version: 0,

  setCraftingState: (craftingState, selectedRecipe, timer, station, version) =>
    set({ craftingState, selectedRecipe, timer, station, version }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}));

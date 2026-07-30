import { create } from "zustand";
import type { ClockSnapshot } from "@worldnest/game-engine";

interface UIState {
  /** Latest world clock snapshot, or `null` before the game has booted. */
  clock: ClockSnapshot | null;
  inventoryOpen: boolean;
  /** Build mode shows the placement ghost and enables `Q` / left-click placing. */
  buildMode: boolean;
  /** The corner minimap, toggled with `M`. Read by the Phaser overlay. */
  minimapOpen: boolean;
  /** The settings panel (language, and audio from item 13), toggled with `P`. */
  settingsOpen: boolean;
  /** The quest log, toggled with `J`. */
  questLogOpen: boolean;

  setClock: (clock: ClockSnapshot) => void;
  setInventoryOpen: (inventoryOpen: boolean) => void;
  toggleInventory: () => void;
  setBuildMode: (buildMode: boolean) => void;
  toggleBuildMode: () => void;
  setMinimapOpen: (minimapOpen: boolean) => void;
  toggleMinimap: () => void;
  setSettingsOpen: (settingsOpen: boolean) => void;
  toggleSettings: () => void;
  setQuestLogOpen: (questLogOpen: boolean) => void;
  toggleQuestLog: () => void;
}

/**
 * HUD-only state that the game pushes into React. Kept separate from `gameStore`
 * so purely presentational toggles never re-render simulation consumers.
 */
export const useUIStore = create<UIState>((set) => ({
  clock: null,
  inventoryOpen: false,
  buildMode: false,
  minimapOpen: true,
  settingsOpen: false,
  questLogOpen: false,

  setClock: (clock) => set({ clock }),

  setInventoryOpen: (inventoryOpen) => set({ inventoryOpen }),

  toggleInventory: () => set((state) => ({ inventoryOpen: !state.inventoryOpen })),

  setBuildMode: (buildMode) => set({ buildMode }),

  toggleBuildMode: () => set((state) => ({ buildMode: !state.buildMode })),

  setMinimapOpen: (minimapOpen) => set({ minimapOpen }),

  toggleMinimap: () => set((state) => ({ minimapOpen: !state.minimapOpen })),

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),

  setQuestLogOpen: (questLogOpen) => set({ questLogOpen }),

  toggleQuestLog: () => set((state) => ({ questLogOpen: !state.questLogOpen })),
}));

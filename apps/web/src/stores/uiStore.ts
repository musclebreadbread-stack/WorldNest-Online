import { create } from "zustand";
import type { ClockSnapshot } from "@worldnest/game-engine";

interface UIState {
  /** Latest world clock snapshot, or `null` before the game has booted. */
  clock: ClockSnapshot | null;

  setClock: (clock: ClockSnapshot) => void;
}

/**
 * HUD-only state that the game pushes into React. Kept separate from `gameStore`
 * so purely presentational toggles never re-render simulation consumers.
 */
export const useUIStore = create<UIState>((set) => ({
  clock: null,

  setClock: (clock) => set({ clock }),
}));

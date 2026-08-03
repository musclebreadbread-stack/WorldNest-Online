import { create } from "zustand";
import type { HousingState, RoomType } from "@worldnest/game-engine";
import { createDefaultHousingState } from "@worldnest/game-engine";

interface HousingStoreState {
  /** Mirrored from HousingComponent.state. */
  housingState: HousingState;
  /** Whether the housing panel is open. */
  panelOpen: boolean;
  /** The version counter from HousingComponent, for change detection. */
  version: number;

  setHousingState: (state: HousingState, version: number) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
  /** Selected room in the UI (not necessarily the activeRoom). */
  selectedRoom: RoomType;
  setSelectedRoom: (room: RoomType) => void;
}

/**
 * Zustand store bridging the HousingComponent state to the React UI.
 * The game loop pushes state here on version changes.
 */
export const useHousingStore = create<HousingStoreState>((set) => ({
  housingState: createDefaultHousingState(),
  panelOpen: false,
  version: 0,
  selectedRoom: "living_room",

  setHousingState: (housingState, version) => set({ housingState, version }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setSelectedRoom: (selectedRoom) => set({ selectedRoom }),
}));

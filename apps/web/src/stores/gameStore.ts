import { create } from "zustand";
import type { InventorySlot } from "@worldnest/game-engine";
import { INVENTORY_SLOTS } from "@worldnest/shared";

export interface OnlinePlayer {
  playerId: string;
  username: string;
  x: number;
  y: number;
}

interface GameState {
  playerX: number;
  playerY: number;
  chunkX: number;
  chunkY: number;
  onlinePlayers: Map<string, OnlinePlayer>;
  connectionStatus: "disconnected" | "connecting" | "connected";
  /** Mirror of the local player's InventoryComponent slots. */
  inventorySlots: Array<InventorySlot | null>;
  selectedSlot: number;

  setPlayerPosition: (x: number, y: number, chunkX: number, chunkY: number) => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected") => void;
  setInventory: (
    slots: Array<InventorySlot | null>,
    selectedSlot: number,
  ) => void;
  setSelectedSlot: (selectedSlot: number) => void;
  addOnlinePlayer: (player: OnlinePlayer) => void;
  removeOnlinePlayer: (playerId: string) => void;
  updateOnlinePlayer: (playerId: string, x: number, y: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  playerX: 0,
  playerY: 0,
  chunkX: 0,
  chunkY: 0,
  onlinePlayers: new Map(),
  connectionStatus: "disconnected",
  inventorySlots: new Array<InventorySlot | null>(INVENTORY_SLOTS).fill(null),
  selectedSlot: 0,

  setPlayerPosition: (x, y, chunkX, chunkY) =>
    set({ playerX: x, playerY: y, chunkX, chunkY }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // The engine owns the slot array, so it is copied on the way in to keep the
  // store's snapshot immutable for React.
  setInventory: (slots, selectedSlot) =>
    set({
      inventorySlots: slots.map((slot) => (slot ? { ...slot } : null)),
      selectedSlot,
    }),

  setSelectedSlot: (selectedSlot) => set({ selectedSlot }),

  addOnlinePlayer: (player) =>
    set((state) => {
      const newMap = new Map(state.onlinePlayers);
      newMap.set(player.playerId, player);
      return { onlinePlayers: newMap };
    }),

  removeOnlinePlayer: (playerId) =>
    set((state) => {
      const newMap = new Map(state.onlinePlayers);
      newMap.delete(playerId);
      return { onlinePlayers: newMap };
    }),

  updateOnlinePlayer: (playerId, x, y) =>
    set((state) => {
      const newMap = new Map(state.onlinePlayers);
      const player = newMap.get(playerId);
      if (player) {
        newMap.set(playerId, { ...player, x, y });
      }
      return { onlinePlayers: newMap };
    }),
}));

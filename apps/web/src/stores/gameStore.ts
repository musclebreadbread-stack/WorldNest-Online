import { create } from "zustand";

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

  setPlayerPosition: (x: number, y: number, chunkX: number, chunkY: number) => void;
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected") => void;
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

  setPlayerPosition: (x, y, chunkX, chunkY) =>
    set({ playerX: x, playerY: y, chunkX, chunkY }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

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

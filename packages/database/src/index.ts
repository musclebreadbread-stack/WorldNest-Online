export { createSupabaseClient } from "./client";
export type { Database, Tables } from "./types";
export { signUp, signIn, signOut, onAuthStateChange, getSession, getUser } from "./auth";
export {
  RealtimeManager,
  joinRoom,
  broadcastPosition,
} from "./realtime";
export type {
  PlayerPosition,
  PlayerPresence,
  PlayerJoinedCallback,
  PlayerLeftCallback,
  PlayerMovedCallback,
} from "./realtime";

export { createSupabaseClient } from "./client";
export type { Database, Tables, Inserts, DbResult } from "./types";
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
  ChatMessageCallback,
} from "./realtime";
export { loadRecentMessages, sendMessage, CHAT_MESSAGE_MAX_LENGTH } from "./chat";
export type { ChatMessage, ChatMessageRow } from "./chat";
export { getProfile, upsertProfile } from "./profiles";
export type { Profile } from "./profiles";
export { loadPlayerState, savePlayerState } from "./playerState";
export type {
  PlayerState,
  PlayerStateSave,
  PersistedInventory,
  PersistedInventorySlot,
} from "./playerState";
export { loadQuests, saveQuest, saveQuests } from "./progression";
export type { PlayerQuest, PersistedQuest } from "./progression";
export { getDefaultWorld, DEFAULT_WORLD_NAME } from "./worlds";
export type { World } from "./worlds";
export {
  loadWorldModifications,
  saveWorldModification,
  loadStructures,
  saveStructure,
  deleteStructure,
  loadCrops,
  saveCrop,
  deleteCrop,
} from "./worldMods";
export type {
  WorldModification,
  WorldModificationSave,
  Structure,
  StructureSave,
  Crop,
  CropSave,
} from "./worldMods";

import { create } from "zustand";
import type { ChatMessage } from "@worldnest/database";

/** Newest messages kept in memory; older ones are dropped from the top. */
export const CHAT_HISTORY_LIMIT = 100;

/** Sends a message on the realtime channel. Injected once the channel is live. */
export type ChatSender = (body: string) => void;

interface ChatState {
  messages: ChatMessage[];
  /** Messages received since the player last focused the chat input. */
  unread: number;
  /**
   * Live arrivals since the session started, never reset and never capped.
   *
   * `messages.length` cannot serve this purpose: it stops growing once the log
   * hits `CHAT_HISTORY_LIMIT`, at which point `SoundManager`'s diff would stop
   * hearing new messages. Loaded history does not count, so opening a busy room
   * does not fire fifty cues at once.
   */
  received: number;
  /**
   * Whether the chat input has keyboard focus. The game's key handling is gated
   * on this so typing never moves the player.
   */
  inputFocused: boolean;
  sender: ChatSender | null;

  addMessage: (message: ChatMessage) => void;
  prependHistory: (messages: ChatMessage[]) => void;
  clearUnread: () => void;
  setInputFocused: (inputFocused: boolean) => void;
  setSender: (sender: ChatSender | null) => void;
}

/**
 * Chat log plus the focus flag the input gate depends on.
 * Separate from `uiStore` because chat is the only HUD surface that takes
 * keyboard focus away from the game.
 */
export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  unread: 0,
  received: 0,
  inputFocused: false,
  sender: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message].slice(-CHAT_HISTORY_LIMIT),
      unread: state.inputFocused ? state.unread : state.unread + 1,
      received: state.received + 1,
    })),

  // History arrives asynchronously, so it is merged in front of whatever has
  // already been received live rather than replacing it.
  prependHistory: (messages) =>
    set((state) => ({
      messages: [...messages, ...state.messages].slice(-CHAT_HISTORY_LIMIT),
    })),

  clearUnread: () => set({ unread: 0 }),

  setInputFocused: (inputFocused) =>
    set((state) => ({ inputFocused, unread: inputFocused ? 0 : state.unread })),

  setSender: (sender) => set({ sender }),
}));

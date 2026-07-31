/**
 * Shared chat constants used by both server-side enforcement and client-side UI.
 *
 * The server (migration 006) is the source of truth for enforcement; these
 * constants let the client pre-validate and display cooldown timers without a
 * round trip.
 */

/** Maximum messages a player can send per minute. */
export const CHAT_RATE_LIMIT_PER_MINUTE = 10;

/** Maximum message length in characters. */
export const CHAT_MAX_LENGTH = 240;

/** Cooldown between messages in milliseconds (60000 / rate limit). */
export const CHAT_COOLDOWN_MS = 6000;

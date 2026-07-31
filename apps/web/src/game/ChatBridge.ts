import { loadRecentMessages, sendMessage } from "@worldnest/database";
import type { ChatMessage, RealtimeManager } from "@worldnest/database";
import { useChatStore } from "../stores/chatStore";

/** Number of stored messages pulled in as history when a session starts. */
const HISTORY_LIMIT = 50;

/**
 * Connect the realtime chat channel to `chatStore`.
 *
 * Outgoing messages take both paths: a broadcast for instant delivery and a row
 * insert as the durable record other sessions load as history. The row write is
 * best-effort, matching the rest of the persistence layer — chat still works in
 * a session with no database behind it, it just is not remembered.
 *
 * Returns a teardown function for the effect that created it.
 */
export function wireChat(manager: RealtimeManager, worldId: string | null): () => void {
  const { addMessage, prependHistory, setSender } = useChatStore.getState();

  manager.setChatCallback((message) => addMessage(message));

  setSender((body) => {
    const message = manager.sendChat(body);
    // Broadcast does not echo to the sender, so the local copy is added here
    addMessage(message);
    if (worldId) persist(worldId, message);
  });

  if (worldId) {
    void loadHistory(worldId, prependHistory);
  }

  return () => setSender(null);
}

async function loadHistory(
  worldId: string,
  prependHistory: (messages: ChatMessage[]) => void,
): Promise<void> {
  try {
    const { data } = await loadRecentMessages(worldId, HISTORY_LIMIT);
    if (data.length > 0) prependHistory(data);
  } catch {
    // Supabase not configured; the session starts with an empty log
  }
}

function persist(worldId: string, message: ChatMessage): void {
  try {
    void sendMessage(worldId, message.playerId, message.username, message.body).catch(
      () => undefined,
    );
  } catch {
    // Best-effort: a failed write must not swallow the message locally
  }
}

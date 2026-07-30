import { createSupabaseClient } from "./client";
import type { DbResult, Tables } from "./types";

export type ChatMessageRow = Tables<"chat_messages">;

/**
 * A chat message as the client consumes it.
 *
 * The same shape is used for stored history and for realtime broadcasts, so the
 * UI never has to care which path a message arrived on.
 */
export interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  body: string;
  createdAt: string;
}

/** Longest message accepted; anything beyond this is truncated on send. */
export const CHAT_MESSAGE_MAX_LENGTH = 240;

function toChatMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    playerId: row.sender_id,
    username: row.username,
    body: row.body,
    createdAt: row.created_at,
  };
}

/**
 * Recent chat history for a world, oldest first.
 * The index is on `(world_id, created_at desc)`, so the newest rows are read
 * and then reversed for display.
 */
export async function loadRecentMessages(
  worldId: string,
  limit = 50,
): Promise<DbResult<ChatMessage[]>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("chat_messages")
    .select("*")
    .eq("world_id", worldId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    data: (data ?? []).map(toChatMessage).reverse(),
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Write a chat message. Broadcast is what makes delivery instant; this row is
 * the durable record other sessions load as history.
 */
export async function sendMessage(
  worldId: string,
  senderId: string,
  username: string,
  body: string,
): Promise<DbResult<ChatMessage | null>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("chat_messages")
    .insert({
      world_id: worldId,
      sender_id: senderId,
      username,
      body: body.slice(0, CHAT_MESSAGE_MAX_LENGTH),
    })
    .select()
    .maybeSingle();

  return {
    data: data ? toChatMessage(data) : null,
    error: error ? new Error(error.message) : null,
  };
}

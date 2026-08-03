import { createSupabaseClient } from "./client";
import type { DbResult } from "./types";

/**
 * The result from the `worldnest_send_chat` RPC function.
 */
export interface SendChatResult {
  ok: boolean;
  message_id: string | null;
  sanitized_body: string | null;
  reason: string | null;
}

/**
 * A row in the mute_list table.
 */
export interface MuteEntry {
  muter_id: string;
  muted_id: string;
  created_at: string;
}

/**
 * Send a chat message through the authoritative RPC function.
 *
 * The function enforces rate limiting, word filtering, and message truncation
 * server-side. Returns the sanitized body on success, or a reason on failure.
 */
export async function sendMessageViaRpc(
  worldId: string,
  body: string,
): Promise<DbResult<SendChatResult>> {
  const client = createSupabaseClient();
  const { data, error } = await client.rpc("worldnest_send_chat", {
    p_world_id: worldId,
    p_body: body,
  });

  if (error) {
    return {
      data: {
        ok: false,
        message_id: null,
        sanitized_body: null,
        reason: error.message,
      },
      error: new Error(error.message),
    };
  }

  return { data: parseSendChatResult(data), error: null };
}

/**
 * Mute a player so their messages are hidden from the current user.
 */
export async function mutePlayer(mutedId: string): Promise<DbResult<MuteEntry | null>> {
  const client = createSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { data: null, error: new Error("unauthenticated") };
  }

  const { data, error } = await client
    .from("mute_list")
    .insert({ muter_id: user.id, muted_id: mutedId })
    .select()
    .maybeSingle();

  return {
    data: data as MuteEntry | null,
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Unmute a player, restoring visibility of their messages.
 */
export async function unmutePlayer(mutedId: string): Promise<DbResult<null>> {
  const client = createSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { data: null, error: new Error("unauthenticated") };
  }

  const { error } = await client
    .from("mute_list")
    .delete()
    .eq("muter_id", user.id)
    .eq("muted_id", mutedId);

  return { data: null, error: error ? new Error(error.message) : null };
}

/**
 * Get the current user's mute list.
 */
export async function getMuteList(): Promise<DbResult<MuteEntry[]>> {
  const client = createSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { data: [], error: new Error("unauthenticated") };
  }

  const { data, error } = await client
    .from("mute_list")
    .select("*")
    .eq("muter_id", user.id)
    .order("created_at", { ascending: false });

  return {
    data: (data ?? []) as MuteEntry[],
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Parse the jsonb response from worldnest_send_chat into a typed result.
 */
function parseSendChatResult(value: unknown): SendChatResult {
  if (typeof value !== "object" || value === null) {
    return {
      ok: false,
      message_id: null,
      sanitized_body: null,
      reason: "bad_response",
    };
  }

  const record = value as Record<string, unknown>;

  if (record.ok === true) {
    return {
      ok: true,
      message_id: typeof record.message_id === "string" ? record.message_id : null,
      sanitized_body:
        typeof record.sanitized_body === "string" ? record.sanitized_body : null,
      reason: null,
    };
  }

  return {
    ok: false,
    message_id: null,
    sanitized_body: null,
    reason: typeof record.reason === "string" ? record.reason : "bad_response",
  };
}

import { createSupabaseClient } from "./client";
import type { DbResult, Inserts, Tables } from "./types";

export type Profile = Tables<"profiles">;

/**
 * Load a player's profile. Returns `null` data when the row does not exist yet,
 * which is not treated as an error — migration 002's `handle_new_user` trigger
 * only provisions profiles for accounts created after it was applied.
 */
export async function getProfile(playerId: string): Promise<DbResult<Profile | null>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", playerId)
    .maybeSingle();

  return { data: data ?? null, error: error ? new Error(error.message) : null };
}

/**
 * Create or update a profile row. Used as a self-heal path for accounts that
 * predate the provisioning trigger.
 */
export async function upsertProfile(
  profile: Inserts<"profiles">,
): Promise<DbResult<Profile | null>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("profiles")
    .upsert(profile)
    .select()
    .maybeSingle();

  return { data: data ?? null, error: error ? new Error(error.message) : null };
}

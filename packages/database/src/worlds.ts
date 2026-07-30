import { createSupabaseClient } from "./client";
import type { DbResult, Tables } from "./types";

export type World = Tables<"worlds">;

/** Name of the world seeded by 001_initial_schema.sql. */
export const DEFAULT_WORLD_NAME = "Default World";

/**
 * Load the shared world every player joins. Returns `null` data when the seed
 * row is missing (migrations not run), which the client treats as "play
 * offline" rather than as a failure.
 */
export async function getDefaultWorld(): Promise<DbResult<World | null>> {
  const client = createSupabaseClient();
  const { data, error } = await client
    .from("worlds")
    .select("*")
    .eq("name", DEFAULT_WORLD_NAME)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return { data: data ?? null, error: error ? new Error(error.message) : null };
}

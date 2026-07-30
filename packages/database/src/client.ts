import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Create a Supabase client instance.
 * Uses environment variables for URL and anon key.
 */
export function createSupabaseClient(
  supabaseUrl?: string,
  supabaseAnonKey?: string,
): SupabaseClient<Database> {
  const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase URL or anon key. Check your environment variables.");
  }

  return createClient<Database>(url, anonKey);
}

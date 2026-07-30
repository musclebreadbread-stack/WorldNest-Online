import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let cachedClient: SupabaseClient<Database> | null = null;
let cachedUrl: string | null = null;
let cachedAnonKey: string | null = null;

/**
 * Get or create a singleton Supabase client instance.
 * Reuses the same client when URL and key haven't changed,
 * ensuring auth state listeners and session lifecycle work correctly.
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

  // Return cached client if URL and key match
  if (cachedClient && cachedUrl === url && cachedAnonKey === anonKey) {
    return cachedClient;
  }

  cachedClient = createClient<Database>(url, anonKey);
  cachedUrl = url;
  cachedAnonKey = anonKey;

  return cachedClient;
}

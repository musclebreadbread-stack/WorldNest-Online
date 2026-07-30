/**
 * Supabase stores auth in cookies with the pattern `sb-<project-ref>-auth-token`.
 * Extracted from the middleware so the predicate can be unit tested without
 * constructing a NextRequest.
 */
const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-.*-auth-token/;

/**
 * Returns true when at least one of the given cookie names looks like a
 * Supabase auth token cookie.
 */
export function hasSupabaseAuthCookie(names: string[]): boolean {
  return names.some((name) => SUPABASE_AUTH_COOKIE_PATTERN.test(name));
}

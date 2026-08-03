import type {
  SupabaseClient,
  User,
  Session,
  AuthChangeEvent,
} from "@supabase/supabase-js";
import { createSupabaseClient } from "./client";

/**
 * Sign up a new user with email and password.
 */
export async function signUp(
  email: string,
  password: string,
  username?: string,
): Promise<{ user: User | null; error: Error | null }> {
  const client = createSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { username: username || email.split("@")[0] },
    },
  });

  return {
    user: data.user,
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Sign in an existing user with email and password.
 */
export async function signIn(
  email: string,
  password: string,
): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
  const client = createSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  return {
    user: data.user,
    session: data.session,
    error: error ? new Error(error.message) : null,
  };
}

/**
 * Sign out the current user.
 */
export async function signOut(): Promise<{ error: Error | null }> {
  const client = createSupabaseClient();
  const { error } = await client.auth.signOut();
  return { error: error ? new Error(error.message) : null };
}

/**
 * Listen for auth state changes.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): { unsubscribe: () => void } {
  const client = createSupabaseClient();
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(callback);

  return { unsubscribe: () => subscription.unsubscribe() };
}

/**
 * Get the current session.
 */
export async function getSession(): Promise<Session | null> {
  const client = createSupabaseClient();
  const { data } = await client.auth.getSession();
  return data.session;
}

/**
 * Get the current user.
 */
export async function getUser(): Promise<User | null> {
  const client = createSupabaseClient();
  const { data } = await client.auth.getUser();
  return data.user;
}

export type { SupabaseClient, User, Session, AuthChangeEvent };

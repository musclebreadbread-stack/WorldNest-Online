"use client";

import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

/**
 * AuthProvider wraps the app and manages auth state.
 * Listens for auth state changes from Supabase.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, setSession } = useAuthStore();

  useEffect(() => {
    // Attempt to restore session on mount
    const initAuth = async () => {
      try {
        const { getSession } = await import("@worldnest/database");
        const session = await getSession();

        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || "",
            username:
              session.user.user_metadata?.username ||
              session.user.email?.split("@")[0] ||
              "Player",
          });
          setSession(session);
        }
      } catch {
        // Supabase not configured - continue without auth
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { onAuthStateChange } = await import("@worldnest/database");
        const sub = onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || "",
              username:
                session.user.user_metadata?.username ||
                session.user.email?.split("@")[0] ||
                "Player",
            });
            setSession(session);
          } else if (event === "SIGNED_OUT") {
            setUser(null);
            setSession(null);
          }
          setLoading(false);
        });
        unsubscribe = sub.unsubscribe;
      } catch {
        // Supabase not configured
        setLoading(false);
      }
    };

    setupListener();

    return () => {
      unsubscribe?.();
    };
  }, [setUser, setLoading, setSession]);

  return <>{children}</>;
}

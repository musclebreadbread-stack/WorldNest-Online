"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../stores/authStore";

/**
 * SignOutButton ends the Supabase session and returns to the auth page.
 *
 * The database module is imported lazily, matching `AuthProvider`, so an
 * unconfigured Supabase cannot break the game overlay; the local auth state is
 * cleared and the route change happens either way, and the middleware takes over
 * from there.
 */
export function SignOutButton() {
  const router = useRouter();
  const clear = useAuthStore((state) => state.clear);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);

    try {
      const { signOut } = await import("@worldnest/database");
      await signOut();
    } catch {
      // Supabase not configured - fall through to clearing local state
    }

    clear();
    router.push("/auth");
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={signingOut}
      className="rounded bg-black/70 px-3 py-2 text-xs text-gray-200 transition-colors hover:bg-black/90 hover:text-white disabled:opacity-50"
    >
      {signingOut ? "Signing out..." : "Sign out"}
    </button>
  );
}

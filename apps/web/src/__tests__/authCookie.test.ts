import { describe, it, expect } from "vitest";
import { hasSupabaseAuthCookie } from "../lib/authCookie";

describe("hasSupabaseAuthCookie", () => {
  it("should detect a Supabase auth token cookie", () => {
    expect(hasSupabaseAuthCookie(["sb-abcdefgh-auth-token"])).toBe(true);
  });

  it("should detect chunked auth token cookies", () => {
    expect(hasSupabaseAuthCookie(["sb-abcdefgh-auth-token.0"])).toBe(true);
  });

  it("should ignore unrelated cookies", () => {
    expect(hasSupabaseAuthCookie(["theme", "sb-abcdefgh-refresh", "session"])).toBe(
      false,
    );
  });

  it("should return false for no cookies", () => {
    expect(hasSupabaseAuthCookie([])).toBe(false);
  });

  it("should find the auth cookie among other cookies", () => {
    expect(hasSupabaseAuthCookie(["theme", "sb-project-auth-token", "locale"])).toBe(
      true,
    );
  });
});

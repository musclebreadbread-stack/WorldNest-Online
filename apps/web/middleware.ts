import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasSupabaseAuthCookie } from "./src/lib/authCookie";

/**
 * Next.js middleware to protect the /game route at the server level.
 * Checks for the Supabase auth token cookie before serving the page bundle.
 * If no valid session cookie is found, redirects to /auth.
 */
export function middleware(request: NextRequest) {
  const hasAuthCookie = hasSupabaseAuthCookie(
    request.cookies.getAll().map((cookie) => cookie.name),
  );

  if (!hasAuthCookie) {
    const authUrl = new URL("/auth", request.url);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/game/:path*"],
};

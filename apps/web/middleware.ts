import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js middleware to protect the /game route at the server level.
 * Checks for the Supabase auth token cookie before serving the page bundle.
 * If no valid session cookie is found, redirects to /auth.
 */
export function middleware(request: NextRequest) {
  // Supabase stores auth in cookies with the pattern `sb-<project-ref>-auth-token`
  const hasAuthCookie = request.cookies.getAll().some(
    (cookie) => cookie.name.includes("auth-token") || cookie.name.includes("sb-") && cookie.name.includes("-auth-token"),
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

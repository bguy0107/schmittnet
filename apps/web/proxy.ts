import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/src/lib/session-constants";

// Convenience filter only — NOT the authority (Next.js middleware is bypassable,
// CVE-2025-29927). It can't validate the session against Postgres at the edge, so
// it only checks for the cookie's presence and redirects for UX. The real check is
// `auth()` re-running in the service/route layer for every request (see CLAUDE.md).
const PUBLIC_PATHS = [
  "/login",
  "/submit/", // public QR ticket/video-request submission UI
  "/api/auth",
  "/api/tickets/submit/",
  "/api/video-requests/submit/",
  "/api/health",
  "/api/upload/",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

export default function proxy(req: NextRequest) {
  const { nextUrl } = req;
  if (isPublic(nextUrl.pathname)) return NextResponse.next();

  const hasSession = req.cookies.has(SESSION_COOKIE_NAME);
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", encodeURIComponent(nextUrl.pathname));
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)", "/api/:path*"],
};

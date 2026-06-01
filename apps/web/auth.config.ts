import type { NextAuthConfig } from "next-auth";

// Edge-safe base config: no Node.js-only imports (no argon2, no Prisma).
// Imported by proxy.ts so it can run in the edge runtime.
// Full server-side config (with Credentials provider) is in auth.ts.
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  // Credentials provider requires JWT strategy in Auth.js v5 (no database adapter for credentials).
  // Revocation is handled by the session callback in auth.ts re-reading isActive/role on every
  // request — deactivated users and role changes take effect on the very next API call.
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic = [
        "/login",
        "/submit/",       // public QR ticket submission UI
        "/api/auth",
        "/api/tickets/submit/",
        "/api/health",
        "/api/upload/",
      ].some((p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(p));

      if (isPublic) return true;
      if (isLoggedIn) return true;

      const loginUrl = new URL("/login", nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", encodeURIComponent(nextUrl.pathname));
      return Response.redirect(loginUrl);
    },
  },
};

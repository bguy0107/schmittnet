import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Uses edge-safe authConfig only — no argon2 or Prisma imports here.
// Auth is re-verified in the service layer for every API call (see CLAUDE.md).
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)", "/api/:path*"],
};

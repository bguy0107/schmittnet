import { randomBytes, createHash } from "crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Role } from "@schmittnet/types";
import { sessionRepository } from "@/src/repositories/session-repository";
import { SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/src/lib/session-constants";

export { SESSION_COOKIE_NAME, SESSION_DURATION_MS };

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  ownerId: string | null;
};

/**
 * Sessions are server-side (ADR-006): an opaque random token lives in an HttpOnly
 * cookie, and only its SHA-256 hash is stored in Postgres — a DB read alone can't
 * forge or replay a session. Deleting the row revokes the session instantly,
 * unlike a JWT which stays valid until it expires.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = generateSessionToken();
  const expires = new Date(Date.now() + SESSION_DURATION_MS);
  await sessionRepository.create({ tokenHash: hashToken(token), userId, expires });
  return { token, expires };
}

export async function destroySession(token: string): Promise<void> {
  await sessionRepository.deleteByTokenHash(hashToken(token));
}

export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await sessionRepository.deleteAllForUser(userId);
}

async function validateSessionToken(token: string): Promise<SessionUser | null> {
  const tokenHash = hashToken(token);
  const record = await sessionRepository.findByTokenHash(tokenHash);
  if (!record) return null;

  if (record.expires < new Date() || !record.user.isActive) {
    // Opportunistic cleanup — an expired or deactivated user's session is dead weight.
    await sessionRepository.deleteByTokenHash(tokenHash);
    return null;
  }

  return {
    id: record.user.id,
    email: record.user.email,
    name: record.user.name,
    role: record.user.role,
    ownerId: record.user.ownerId,
  };
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function setSessionCookie(token: string, expires: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, cookieOptions(expires));
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Cached per-request (React `cache`) — mirrors Auth.js's `auth()` so layouts,
 * pages, and route handlers can all call it without piling up DB round trips.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  return validateSessionToken(token);
});

import { getSessionUser, type SessionUser } from "@/src/lib/session";

/**
 * Server-side session lookup (ADR-006). Cached per-request via React `cache`
 * inside `getSessionUser` — safe to call from layouts, pages, and route handlers
 * without piling up DB round trips. Returns `null` when there's no valid session,
 * mirroring Auth.js's `auth()` shape so existing call sites (`session?.user`) work
 * unchanged.
 */
export async function auth(): Promise<{ user: SessionUser } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return { user };
}

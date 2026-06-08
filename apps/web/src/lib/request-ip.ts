import { NextRequest } from "next/server";

/**
 * Returns the client IP for rate-limiting public endpoints.
 *
 * Caddy's reverse_proxy appends the connecting peer's address to any
 * existing X-Forwarded-For header rather than overwriting it, so the
 * *first* entry can be set by the client and is attacker-spoofable. The
 * *last* entry is always the address Caddy itself observed on the TCP
 * connection — trustworthy as long as Caddy is the sole edge proxy.
 */
export function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return "unknown";
  const hops = xff.split(",").map((hop) => hop.trim()).filter(Boolean);
  return hops.at(-1) ?? "unknown";
}

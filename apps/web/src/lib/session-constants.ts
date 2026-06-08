// Edge-safe constants only (no Prisma/Node imports) — shared between the
// full session lib (`session.ts`, Node runtime) and `proxy.ts` (edge runtime),
// mirroring the existing authConfig/auth.ts split.
export const SESSION_COOKIE_NAME = "schmittnet_session";
export const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

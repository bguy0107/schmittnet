import { redis } from "@/src/lib/redis";
import { RateLimitError } from "@/src/lib/errors";

// Per-token limit is primary because many staff at one location share a NAT IP.
const TOKEN_LIMIT = 10;  // max submissions per token per window
const IP_LIMIT = 30;     // secondary per-IP limit per window
const WINDOW_SECONDS = 60;

const PRESIGN_IP_LIMIT = 20; // max presigned-URL requests per IP per window

export async function enforceSubmitRateLimit(token: string, ip: string): Promise<void> {
  const now = Date.now();
  const windowStart = now - WINDOW_SECONDS * 1000;

  const tokenKey = `ratelimit:submit:token:${token}`;
  const ipKey = `ratelimit:submit:ip:${ip}`;

  const [tokenCount, ipCount] = await Promise.all([
    slidingWindowCount(tokenKey, now, windowStart),
    slidingWindowCount(ipKey, now, windowStart),
  ]);

  if (tokenCount > TOKEN_LIMIT) {
    throw new RateLimitError("Too many submissions from this location. Please wait a minute.");
  }
  if (ipCount > IP_LIMIT) {
    throw new RateLimitError("Too many submissions from this network. Please wait a minute.");
  }
}

export async function enforcePresignRateLimit(ip: string): Promise<void> {
  const now = Date.now();
  const windowStart = now - WINDOW_SECONDS * 1000;
  const key = `ratelimit:presign:ip:${ip}`;
  const count = await slidingWindowCount(key, now, windowStart);
  if (count > PRESIGN_IP_LIMIT) {
    throw new RateLimitError("Too many upload requests. Please wait a minute.");
  }
}

async function slidingWindowCount(key: string, now: number, windowStart: number): Promise<number> {
  const member = `${now}-${Math.random().toString(36).slice(2)}`;

  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, now, member);
  pipeline.zcard(key);
  pipeline.expire(key, WINDOW_SECONDS * 2); // TTL headroom prevents stale key accumulation

  const results = await pipeline.exec();
  return (results?.[2]?.[1] as number | null) ?? 0;
}

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp } from "./request-ip";

function reqWithXff(value: string | null): NextRequest {
  const headers = new Headers();
  if (value !== null) headers.set("x-forwarded-for", value);
  return new NextRequest("https://example.com/api/tickets/submit/token", { headers });
}

describe("getClientIp", () => {
  it("returns the last hop, which is the address Caddy observed directly", () => {
    expect(getClientIp(reqWithXff("203.0.113.5"))).toBe("203.0.113.5");
    expect(getClientIp(reqWithXff("203.0.113.5, 198.51.100.20"))).toBe("198.51.100.20");
  });

  it("ignores a spoofed leading hop supplied by the client", () => {
    // Caddy appends the real peer address rather than overwriting the header,
    // so an attacker-supplied first hop must not be trusted.
    expect(getClientIp(reqWithXff("1.2.3.4, 198.51.100.20"))).toBe("198.51.100.20");
  });

  it("trims whitespace around hops", () => {
    expect(getClientIp(reqWithXff("203.0.113.5 ,  198.51.100.20  "))).toBe("198.51.100.20");
  });

  it("returns 'unknown' when the header is absent or empty", () => {
    expect(getClientIp(reqWithXff(null))).toBe("unknown");
    expect(getClientIp(reqWithXff(""))).toBe("unknown");
    expect(getClientIp(reqWithXff(" , "))).toBe("unknown");
  });
});

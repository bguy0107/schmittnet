import { NextResponse } from "next/server";
import { destroySession, clearSessionCookie, getSessionToken } from "@/src/lib/session";

export async function POST() {
  const token = await getSessionToken();
  if (token) await destroySession(token);
  await clearSessionCookie();

  return new NextResponse(null, { status: 204 });
}

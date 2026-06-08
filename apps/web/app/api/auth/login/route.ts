import { NextRequest, NextResponse } from "next/server";
import { authService } from "@/src/services/auth-service";
import { createSession, setSessionCookie } from "@/src/lib/session";
import { toApiError, AppError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

export async function POST(req: NextRequest) {
  const body: unknown = await req.json();

  try {
    const user = await authService.login(body);
    const { token, expires } = await createSession(user.id);
    await setSessionCookie(token, expires);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, ownerId: user.ownerId },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("POST /api/auth/login unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

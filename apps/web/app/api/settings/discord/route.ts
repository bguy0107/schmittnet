import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { settingsService } from "@/src/services/settings-service";
import { toApiError, AppError, UnauthorizedError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  try {
    const settings = await settingsService.getDiscordSettings(session.user.role);
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("GET /api/settings/discord unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const body: unknown = await req.json();

  try {
    await settingsService.updateDiscordWebhook(session.user.role, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("PUT /api/settings/discord unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

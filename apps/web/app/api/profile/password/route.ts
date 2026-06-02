import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { profileService } from "@/src/services/profile-service";
import { toApiError, AppError, UnauthorizedError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const body: unknown = await req.json();

  try {
    await profileService.changePassword(session.user.id, body);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("POST /api/profile/password unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

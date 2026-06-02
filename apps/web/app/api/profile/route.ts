import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { profileService } from "@/src/services/profile-service";
import { toApiError, AppError, UnauthorizedError, NotFoundError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  try {
    const profile = await profileService.getProfile(session.user.id);
    if (!profile) {
      return NextResponse.json(toApiError(new NotFoundError("User not found")), { status: 404 });
    }
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("GET /api/profile unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const body: unknown = await req.json();

  try {
    const profile = await profileService.updateProfile(session.user.id, body);
    return NextResponse.json(profile);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("PATCH /api/profile unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

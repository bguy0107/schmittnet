import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { videoRequestService } from "@/src/services/video-request-service";
import { toApiError, AppError, UnauthorizedError, ForbiddenError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  if (session.user.role !== "TECHNICIAN" && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json(toApiError(new ForbiddenError("Only IT technicians may resolve video requests")), { status: 403 });
  }

  const { id } = await params;
  const body: unknown = await req.json();

  try {
    const result = await videoRequestService.resolveVideoRequest(
      id,
      session.user.id,
      session.user.role,
      session.user.ownerId,
      body,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("PATCH /api/video-requests/[id]/resolve unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

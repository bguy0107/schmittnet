import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { locationService } from "@/src/services/location-service";
import { toApiError, AppError, UnauthorizedError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const { id } = await params;

  try {
    await locationService.deleteLocation(id, session.user.role);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("DELETE /api/locations/[id] unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const { id } = await params;
  const body: unknown = await req.json();

  try {
    const location = await locationService.updateLocation(id, session.user.role, body);
    return NextResponse.json(location);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("PATCH /api/locations/[id] unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

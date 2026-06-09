import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { videoRequestService } from "@/src/services/video-request-service";
import { toApiError, AppError, UnauthorizedError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

const listQuerySchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "CANCELLED"]).optional(),
  locationId: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const parsed = listQuerySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
    locationId: searchParams.get("locationId") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const filter = parsed.data;

  try {
    const result = await videoRequestService.listVideoRequests(
      session.user.id,
      session.user.role,
      session.user.ownerId,
      filter,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("GET /api/video-requests unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const body: unknown = await req.json();
  try {
    const result = await videoRequestService.createVideoRequest(
      session.user.id,
      session.user.email,
      session.user.role,
      session.user.ownerId,
      body,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body", details: error.flatten() }, { status: 400 });
    }
    logger.error("POST /api/video-requests unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

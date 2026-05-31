import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ticketService } from "@/src/services/ticket-service";
import { toApiError, AppError, UnauthorizedError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const filter = {
    status: searchParams.get("status") ?? undefined,
    category: searchParams.get("category") ?? undefined,
    locationId: searchParams.get("locationId") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
    pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : undefined,
  };

  try {
    const result = await ticketService.listTickets(
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
    logger.error("GET /api/tickets unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

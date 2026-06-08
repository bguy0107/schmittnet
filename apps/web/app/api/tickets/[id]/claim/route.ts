import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ticketService } from "@/src/services/ticket-service";
import { toApiError, AppError, UnauthorizedError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const { id } = await params;
  try {
    const result = await ticketService.claimTicket(id, session.user.id, session.user.role, session.user.ownerId ?? null);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("POST /api/tickets/[id]/claim unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

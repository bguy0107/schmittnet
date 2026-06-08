import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ticketService } from "@/src/services/ticket-service";
import { toApiError, AppError, UnauthorizedError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const { id } = await params;
  const body: unknown = await req.json();

  // approvalId must be supplied in the body since we need to address a specific approval record
  const { approvalId, ...rest } = body as { approvalId: string } & Record<string, unknown>;

  try {
    const result = await ticketService.resolveApproval(
      id,
      approvalId,
      session.user.id,
      session.user.role,
      session.user.ownerId ?? null,
      rest,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("PATCH /api/tickets/[id]/approval unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

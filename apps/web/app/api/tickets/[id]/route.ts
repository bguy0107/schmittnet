import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ticketService } from "@/src/services/ticket-service";
import { getSignedReadUrl } from "@/src/lib/minio";
import { toApiError, AppError, UnauthorizedError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const { id } = await params;
  try {
    const ticket = await ticketService.getTicketById(id, session.user.role, session.user.ownerId);

    const media = await Promise.all(
      ticket.media.map(async (m) => ({
        ...m,
        signedUrl: await getSignedReadUrl(m.storageKey),
      })),
    );

    return NextResponse.json({ ...ticket, media });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("GET /api/tickets/[id] unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

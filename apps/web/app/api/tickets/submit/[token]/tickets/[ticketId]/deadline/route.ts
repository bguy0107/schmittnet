import { NextRequest, NextResponse } from "next/server";
import { ticketService } from "@/src/services/ticket-service";
import { enforceSubmitRateLimit } from "@/src/proxy/rate-limit";
import { toApiError, AppError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

type Params = { params: Promise<{ token: string; ticketId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { token, ticketId } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    await enforceSubmitRateLimit(token, ip);
    const body: unknown = await req.json();
    const result = await ticketService.updatePublicDeadline(token, ticketId, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("PATCH /api/tickets/submit/[token]/tickets/[ticketId]/deadline unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

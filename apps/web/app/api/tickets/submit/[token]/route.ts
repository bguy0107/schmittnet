import { NextRequest, NextResponse } from "next/server";
import { ticketService } from "@/src/services/ticket-service";
import { enforceSubmitRateLimit } from "@/src/proxy/rate-limit";
import { toApiError, AppError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  try {
    const location = await ticketService.getLocationContext(token);
    return NextResponse.json(location);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("GET /api/tickets/submit/[token] unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  try {
    await enforceSubmitRateLimit(token, ip);
    const body: unknown = await req.json();
    const result = await ticketService.submitTicket(token, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("POST /api/tickets/submit/[token] unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

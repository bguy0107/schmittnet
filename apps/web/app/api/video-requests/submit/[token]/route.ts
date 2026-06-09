import { NextRequest, NextResponse } from "next/server";
import { videoRequestService } from "@/src/services/video-request-service";
import { enforceSubmitRateLimit } from "@/src/proxy/rate-limit";
import { getClientIp } from "@/src/lib/request-ip";
import { toApiError, AppError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

type Params = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const ip = getClientIp(req);

  try {
    await enforceSubmitRateLimit(token, ip);
    const body: unknown = await req.json();
    const result = await videoRequestService.submitVideoRequest(token, body);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("POST /api/video-requests/submit/[token] unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { videoRequestService } from "@/src/services/video-request-service";
import { enforceCancelRateLimit } from "@/src/proxy/rate-limit";
import { getClientIp } from "@/src/lib/request-ip";
import { toApiError, AppError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

type Params = { params: Promise<{ token: string; id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { token, id } = await params;
  const ip = getClientIp(req);

  try {
    await enforceCancelRateLimit(token, ip);
    const body: unknown = await req.json();
    const result = await videoRequestService.cancelPublicVideoRequest(token, id, body);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("POST /api/video-requests/submit/[token]/[id]/cancel unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

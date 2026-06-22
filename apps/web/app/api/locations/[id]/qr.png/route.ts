import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { auth } from "@/auth";
import { locationService } from "@/src/services/location-service";
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
    const location = await locationService.getLocation(id, session.user.role, session.user.ownerId);

    const hdrs = await headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const submitUrl = `${proto}://${host}/submit/${location.qrToken}`;

    const buffer = await QRCode.toBuffer(submitUrl, {
      type: "png",
      width: 600,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const safeName = location.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${safeName}-qr.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("GET /api/locations/[id]/qr.png unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

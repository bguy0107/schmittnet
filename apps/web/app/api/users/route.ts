import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { userService } from "@/src/services/user-service";
import { toApiError, AppError, UnauthorizedError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  try {
    const users = await userService.listUsers(session.user.role);
    return NextResponse.json(users);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("GET /api/users unexpected error", { error: String(error) });
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
    const user = await userService.createUser(session.user.role, body);
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("POST /api/users unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

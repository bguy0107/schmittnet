import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/src/lib/prisma";
import { locationRepository } from "@/src/repositories/location-repository";
import { toApiError, AppError, UnauthorizedError, ForbiddenError, ValidationError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

const dateRangeSchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(toApiError(new UnauthorizedError()), { status: 401 });
  }

  const { role, ownerId } = session.user;
  if (role === "TECHNICIAN") {
    return NextResponse.json(toApiError(new ForbiddenError("Technicians cannot access the dashboard")), {
      status: 403,
    });
  }

  const parsed = dateRangeSchema.safeParse({
    from: req.nextUrl.searchParams.get("from") ?? undefined,
    to: req.nextUrl.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      toApiError(new ValidationError("Invalid date format. Use YYYY-MM-DD.", parsed.error.flatten())),
      { status: 400 },
    );
  }

  const dateFilter =
    parsed.data.from || parsed.data.to
      ? {
          createdAt: {
            ...(parsed.data.from ? { gte: new Date(parsed.data.from) } : {}),
            ...(parsed.data.to ? { lte: new Date(`${parsed.data.to}T23:59:59.999Z`) } : {}),
          },
        }
      : {};

  try {
    const locationIds =
      role === "SUPER_ADMIN"
        ? undefined
        : ownerId
          ? await locationRepository.getLocationIdsByOwner(ownerId)
          : [];

    const where = {
      ...(locationIds ? { locationId: { in: locationIds } } : {}),
      ...dateFilter,
    };

    const [statusCounts, resolvedTickets, byLocation] = await Promise.all([
      prisma.ticket.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.ticket.findMany({
        where: { ...where, status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
      prisma.ticket.groupBy({
        by: ["locationId"],
        where,
        _count: { _all: true },
        orderBy: { _count: { locationId: "desc" } },
        take: 10,
      }),
    ]);

    const countByStatus = Object.fromEntries(
      statusCounts.map((s: { status: string; _count: { _all: number } }) => [s.status, s._count._all]),
    );

    const avgResolutionMs =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum, t) => {
            return sum + (t.resolvedAt!.getTime() - t.createdAt.getTime());
          }, 0) / resolvedTickets.length
        : null;

    const locationNames = await prisma.location.findMany({
      where: locationIds ? { id: { in: locationIds } } : undefined,
      select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(locationNames.map((l) => [l.id, l.name]));

    return NextResponse.json({
      open: countByStatus["OPEN"] ?? 0,
      inProgress: countByStatus["IN_PROGRESS"] ?? 0,
      awaitingApproval: countByStatus["AWAITING_APPROVAL"] ?? 0,
      resolved: countByStatus["RESOLVED"] ?? 0,
      avgResolutionHours: avgResolutionMs ? avgResolutionMs / 1000 / 60 / 60 : null,
      ticketsByLocation: byLocation.map((r) => ({
        locationName: nameMap[r.locationId] ?? r.locationId,
        count: r._count._all,
      })),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("GET /api/reporting/dashboard unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

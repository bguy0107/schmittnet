import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/src/lib/prisma";
import { locationRepository } from "@/src/repositories/location-repository";
import { toApiError, AppError, UnauthorizedError, ForbiddenError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";

export async function GET() {
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

  try {
    const locationIds =
      role === "SUPER_ADMIN"
        ? undefined
        : ownerId
          ? await locationRepository.getLocationIdsByOwner(ownerId)
          : [];

    const where = locationIds ? { locationId: { in: locationIds } } : {};

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
      statusCounts.map((s) => [s.status, s._count._all]),
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

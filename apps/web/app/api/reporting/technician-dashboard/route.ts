import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/src/lib/prisma";
import { userRepository } from "@/src/repositories/user-repository";
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

  const { role, id: userId } = session.user;
  if (role !== "TECHNICIAN") {
    return NextResponse.json(toApiError(new ForbiddenError("Only technicians can access this endpoint")), {
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
    // Resolve owner + category scope for this technician.
    const techUser = await userRepository.findById(userId);
    const scopedLocationIds = techUser?.ownerId
      ? await locationRepository.getLocationIdsByOwner(techUser.ownerId)
      : undefined;

    const locationFilter = scopedLocationIds ? { locationId: { in: scopedLocationIds } } : {};
    const categoryFilter =
      techUser && techUser.categories.length > 0
        ? { category: { in: techUser.categories } }
        : {};
    const scopeFilter = { ...locationFilter, ...categoryFilter };

    // OPEN tickets: full scope filter, no assignee (unassigned by definition).
    const openWhere = { ...scopeFilter, status: "OPEN" as const };

    // Active workload: assigned to this technician + scope, not date-scoped.
    const workloadWhere = { assignedTo: userId, ...scopeFilter };

    // Historical: assigned to this technician + scope + date range.
    const historicalWhere = { assignedTo: userId, ...scopeFilter, ...dateFilter };

    const [openCount, workloadCounts, categoryCounts, resolvedTickets, byLocation] = await Promise.all([
      prisma.ticket.count({ where: openWhere }),
      prisma.ticket.groupBy({
        by: ["status"],
        where: workloadWhere,
        _count: { _all: true },
      }),
      prisma.ticket.groupBy({
        by: ["category"],
        where: historicalWhere,
        _count: { _all: true },
      }),
      prisma.ticket.findMany({
        where: { ...historicalWhere, status: "RESOLVED", resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
      prisma.ticket.groupBy({
        by: ["locationId"],
        where: historicalWhere,
        _count: { _all: true },
        orderBy: { _count: { locationId: "desc" } },
        take: 10,
      }),
    ]);

    const countByStatus = Object.fromEntries(
      workloadCounts.map((s: { status: string; _count: { _all: number } }) => [s.status, s._count._all]),
    );

    const avgResolutionMs =
      resolvedTickets.length > 0
        ? resolvedTickets.reduce((sum: number, t: { createdAt: Date; resolvedAt: Date | null }) => {
            return sum + (t.resolvedAt!.getTime() - t.createdAt.getTime());
          }, 0) / resolvedTickets.length
        : null;

    const locationIds = byLocation.map((r: { locationId: string }) => r.locationId);
    const locationNames = await prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(locationNames.map((l: { id: string; name: string }) => [l.id, l.name]));

    return NextResponse.json({
      open: openCount,
      inProgress: countByStatus["IN_PROGRESS"] ?? 0,
      onHold: countByStatus["ON_HOLD"] ?? 0,
      awaitingApproval: countByStatus["AWAITING_APPROVAL"] ?? 0,
      resolved: countByStatus["RESOLVED"] ?? 0,
      avgResolutionHours: avgResolutionMs ? avgResolutionMs / 1000 / 60 / 60 : null,
      categories: techUser?.categories ?? [],
      ticketsByCategory: categoryCounts.map((c: { category: string; _count: { _all: number } }) => ({
        category: c.category,
        count: c._count._all,
      })),
      ticketsByLocation: byLocation.map((r: { locationId: string; _count: { _all: number } }) => ({
        locationName: nameMap[r.locationId] ?? r.locationId,
        count: r._count._all,
      })),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(toApiError(error), { status: error.statusCode });
    }
    logger.error("GET /api/reporting/technician-dashboard unexpected error", { error: String(error) });
    return NextResponse.json(toApiError(error), { status: 500 });
  }
}

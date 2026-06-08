import { prisma } from "@/src/lib/prisma";
import type { TicketStatus, Category, Priority } from "@schmittnet/types";
import type { Prisma } from "@prisma/client";

async function fetchUserName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  return user?.name ?? null;
}

export interface ListTicketsFilter {
  locationIds?: string[];
  status?: TicketStatus;
  category?: Category;
  categories?: Category[];
  assignedTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const ticketSummarySelect = {
  id: true,
  category: true,
  status: true,
  priority: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  location: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

const ticketDetailSelect = {
  ...ticketSummarySelect,
  deadline: true,
  onHoldReason: true,
  resolvedAt: true,
  acknowledgedAt: true,
  history: {
    orderBy: { seq: "asc" as const },
    select: {
      id: true,
      type: true,
      content: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  },
  media: {
    orderBy: { createdAt: "asc" as const },
    select: { id: true, storageKey: true, mediaType: true, mimeType: true },
  },
  approvals: {
    where: { status: "PENDING" as const },
    take: 1,
    select: {
      id: true,
      status: true,
      approvalReason: true,
      notes: true,
      createdAt: true,
      requester: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.TicketSelect;

export type TicketSummaryRow = Prisma.TicketGetPayload<{ select: typeof ticketSummarySelect }>;
export type TicketDetailRow = Prisma.TicketGetPayload<{ select: typeof ticketDetailSelect }>;

export const ticketRepository = {
  async findMany(filter: ListTicketsFilter) {
    const { page = 1, pageSize = 25, locationIds, status, category, categories, assignedTo, search } = filter;

    // Resolve effective category filter: explicit single > scoped list > none
    const effectiveCategoryFilter = category
      ? { category }
      : categories && categories.length > 0
        ? { category: { in: categories } }
        : {};

    const where: Prisma.TicketWhereInput = {
      ...(locationIds ? { locationId: { in: locationIds } } : {}),
      ...(status ? { status } : {}),
      ...effectiveCategoryFilter,
      ...(assignedTo ? { assignedTo } : {}),
      ...(search ? { description: { contains: search, mode: "insensitive" } } : {}),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.ticket.findMany({
        where,
        select: ticketSummarySelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ticket.count({ where }),
    ]);

    return { rows, total, page, pageSize };
  },

  async findById(id: string) {
    return prisma.ticket.findUnique({
      where: { id },
      select: ticketDetailSelect,
    });
  },

  async findByIdAndLocation(id: string, locationId: string) {
    return prisma.ticket.findFirst({
      where: { id, locationId },
      select: ticketDetailSelect,
    });
  },

  async create(data: {
    locationId: string;
    category: Category;
    description: string;
    priority: Priority;
    deadline?: Date;
    reporterName?: string;
    mediaKeys: Array<{ storageKey: string; mediaType: "PHOTO" | "VIDEO"; mimeType: string }>;
    actorId?: string | null;
  }) {
    return prisma.ticket.create({
      data: {
        locationId: data.locationId,
        category: data.category,
        description: data.description,
        priority: data.priority,
        deadline: data.deadline,
        reporterName: data.reporterName,
        media: { create: data.mediaKeys },
        history: {
          create: [{
            type: "STATUS_CHANGE",
            toStatus: "OPEN",
            authorId: data.actorId ?? undefined,
          }],
        },
      },
      select: { id: true, createdAt: true },
    });
  },

  async updateStatus(
    id: string,
    status: TicketStatus,
    extra?: { resolvedAt?: Date; onHoldReason?: string | null; assignedTo?: string | null },
  ) {
    return prisma.ticket.update({
      where: { id },
      data: { status, ...extra, updatedAt: new Date() },
      select: { id: true, status: true, locationId: true, category: true },
    });
  },

  // Conditioned on assignedTo being NULL so concurrent claim attempts can't both
  // win — returns false if another technician claimed it first.
  async assign(id: string, userId: string, acknowledgedAt?: Date): Promise<boolean> {
    const { count } = await prisma.ticket.updateMany({
      where: { id, assignedTo: null },
      data: {
        assignedTo: userId,
        acknowledgedAt: acknowledgedAt ?? new Date(),
        updatedAt: new Date(),
      },
    });
    return count === 1;
  },

  async addHistoryNote(ticketId: string, authorId: string | null, content: string) {
    const authorName = await fetchUserName(authorId);
    return prisma.ticketHistory.create({
      data: { ticketId, authorId: authorId ?? undefined, authorName, type: "NOTE", content },
      select: {
        id: true,
        type: true,
        content: true,
        fromStatus: true,
        toStatus: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
    });
  },

  async addStatusChange(
    ticketId: string,
    authorId: string | null,
    fromStatus: string,
    toStatus: string,
  ) {
    const authorName = await fetchUserName(authorId);
    return prisma.ticketHistory.create({
      data: {
        ticketId,
        authorId: authorId ?? undefined,
        authorName,
        type: "STATUS_CHANGE",
        fromStatus: fromStatus as never,
        toStatus: toStatus as never,
      },
      select: { id: true },
    });
  },

  async updateStatusWithNote(
    ticketId: string,
    status: TicketStatus,
    authorId: string,
    fromStatus: string,
    note: string,
    extra?: { resolvedAt?: Date; onHoldReason?: string | null },
  ) {
    const authorName = await fetchUserName(authorId);
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: ticketId },
        data: { status, ...extra, updatedAt: new Date() },
        select: { id: true, status: true, locationId: true, category: true },
      });
      await tx.ticketHistory.create({
        data: { ticketId, authorId, authorName, type: "STATUS_CHANGE", fromStatus: fromStatus as never, toStatus: status as never },
      });
      await tx.ticketHistory.create({
        data: { ticketId, authorId, authorName, type: "NOTE", content: note },
      });
      return ticket;
    });
  },

  async updateDeadline(
    id: string,
    deadline: Date | null,
    oldDeadline: Date | null,
    actorId: string | null,
  ) {
    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    let content: string;
    if (!deadline) {
      content = "Deadline cleared";
    } else if (!oldDeadline) {
      content = `Deadline set to ${formatDate(deadline)}`;
    } else {
      content = `Deadline updated to ${formatDate(deadline)}`;
    }

    const authorName = await fetchUserName(actorId);
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id },
        data: { deadline, updatedAt: new Date() },
        select: { id: true, deadline: true },
      });
      await tx.ticketHistory.create({
        data: {
          ticketId: id,
          authorId: actorId ?? undefined,
          authorName,
          type: "DEADLINE_CHANGE",
          content,
        },
      });
      return ticket;
    });
  },

  async cancelWithNote(ticketId: string, reason: string, fromStatus: string) {
    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.update({
        where: { id: ticketId },
        data: { status: "CANCELLED", updatedAt: new Date() },
        select: { id: true, status: true },
      });
      await tx.ticketHistory.create({
        data: { ticketId, type: "STATUS_CHANGE", fromStatus: fromStatus as never, toStatus: "CANCELLED" },
      });
      await tx.ticketHistory.create({
        data: { ticketId, type: "NOTE", content: reason },
      });
      return ticket;
    });
  },

  async addMedia(ticketId: string, storageKey: string) {
    const ext = storageKey.split(".").pop()?.toLowerCase() ?? "";
    const isVideo = ext === "mp4" || ext === "mov" || ext === "quicktime";
    return prisma.ticketMedia.create({
      data: {
        ticketId,
        storageKey,
        mediaType: isVideo ? "VIDEO" : "PHOTO",
        mimeType: isVideo ? "video/mp4" : "image/jpeg",
      },
      select: { id: true, storageKey: true, mediaType: true },
    });
  },

  // Returns null if a pending approval already exists for this ticket. The row
  // lock makes the existence check atomic with the create — without it, two
  // concurrent requests could both pass the check and create duplicate pending
  // approvals (and double-transition the ticket).
  async createApprovalAndUpdateStatus(ticketId: string, requestedBy: string, fromStatus: string, approvalReason?: string) {
    const authorName = await fetchUserName(requestedBy);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM tickets WHERE id = ${ticketId} FOR UPDATE`;

      const existingPending = await tx.ticketApproval.findFirst({
        where: { ticketId, status: "PENDING" },
        select: { id: true },
      });
      if (existingPending) return null;

      await tx.ticketApproval.create({ data: { ticketId, requestedBy, approvalReason } });
      const ticket = await tx.ticket.update({
        where: { id: ticketId },
        data: { status: "AWAITING_APPROVAL", updatedAt: new Date() },
        select: { id: true, status: true, locationId: true, category: true },
      });
      await tx.ticketHistory.create({
        data: { ticketId, authorId: requestedBy, authorName, type: "STATUS_CHANGE", fromStatus: fromStatus as never, toStatus: "AWAITING_APPROVAL" },
      });
      if (approvalReason) {
        await tx.ticketHistory.create({
          data: { ticketId, authorId: requestedBy, authorName, type: "NOTE", content: `Approval requested: ${approvalReason}` },
        });
      }
      return ticket;
    });
  },

  // Returns null if approvalId doesn't belong to ticketId or isn't PENDING — the
  // updateMany's WHERE clause makes that check atomic with the write, closing the
  // race where two requests could both resolve the same pending approval.
  async resolveApproval(
    approvalId: string,
    approverId: string,
    ticketId: string,
    status: "APPROVED" | "DECLINED",
    notes?: string,
  ) {
    const newTicketStatus = status === "APPROVED" ? "APPROVED" : "IN_PROGRESS";
    const authorName = await fetchUserName(approverId);
    return prisma.$transaction(async (tx) => {
      const { count } = await tx.ticketApproval.updateMany({
        where: { id: approvalId, ticketId, status: "PENDING" },
        data: { approverId, status, notes, resolvedAt: new Date() },
      });
      if (count === 0) return null;

      const approval = await tx.ticketApproval.findUniqueOrThrow({
        where: { id: approvalId },
        select: {
          id: true,
          status: true,
          ticket: { select: { id: true, locationId: true, assignedTo: true } },
          requester: { select: { id: true, name: true } },
        },
      });
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: newTicketStatus, updatedAt: new Date() },
      });
      await tx.ticketHistory.create({
        data: {
          ticketId,
          authorId: approverId,
          authorName,
          type: "STATUS_CHANGE",
          fromStatus: "AWAITING_APPROVAL",
          toStatus: newTicketStatus,
        },
      });
      if (notes) {
        await tx.ticketHistory.create({
          data: { ticketId, authorId: approverId, authorName, type: "NOTE", content: notes },
        });
      }
      return approval;
    });
  },

  async countByStatuses(statuses: TicketStatus[]) {
    return prisma.ticket.count({ where: { status: { in: statuses } } });
  },

  // Permanently removes tickets in the given (terminal) statuses along with their
  // history, approvals, and media rows. Returns the media storage keys so the
  // caller can also remove the underlying objects from MinIO.
  async purgeByStatuses(statuses: TicketStatus[]) {
    const targets = await prisma.ticket.findMany({
      where: { status: { in: statuses } },
      select: { id: true, media: { select: { storageKey: true } } },
    });
    const ticketIds = targets.map((t) => t.id);
    const storageKeys = targets.flatMap((t) => t.media.map((m) => m.storageKey));

    if (ticketIds.length > 0) {
      await prisma.$transaction([
        prisma.ticketHistory.deleteMany({ where: { ticketId: { in: ticketIds } } }),
        prisma.ticketApproval.deleteMany({ where: { ticketId: { in: ticketIds } } }),
        prisma.ticketMedia.deleteMany({ where: { ticketId: { in: ticketIds } } }),
        prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } }),
      ]);
    }

    return { count: ticketIds.length, storageKeys };
  },
};

import { prisma } from "@/src/lib/prisma";
import type { TicketStatus, Category, Priority } from "@schmittnet/types";
import type { Prisma } from "@prisma/client";

export interface ListTicketsFilter {
  locationIds?: string[];
  status?: TicketStatus;
  category?: Category;
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
    orderBy: { createdAt: "asc" as const },
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
    const { page = 1, pageSize = 25, locationIds, status, category, assignedTo, search } = filter;

    const where: Prisma.TicketWhereInput = {
      ...(locationIds ? { locationId: { in: locationIds } } : {}),
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
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
    extra?: { resolvedAt?: Date; onHoldReason?: string; assignedTo?: string | null },
  ) {
    return prisma.ticket.update({
      where: { id },
      data: { status, ...extra, updatedAt: new Date() },
      select: { id: true, status: true, locationId: true, category: true },
    });
  },

  async assign(id: string, userId: string, acknowledgedAt?: Date) {
    return prisma.ticket.update({
      where: { id },
      data: {
        assignedTo: userId,
        acknowledgedAt: acknowledgedAt ?? new Date(),
        updatedAt: new Date(),
      },
      select: { id: true },
    });
  },

  async addHistoryNote(ticketId: string, authorId: string | null, content: string) {
    return prisma.ticketHistory.create({
      data: { ticketId, authorId: authorId ?? undefined, type: "NOTE", content },
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
    return prisma.ticketHistory.create({
      data: {
        ticketId,
        authorId: authorId ?? undefined,
        type: "STATUS_CHANGE",
        fromStatus: fromStatus as never,
        toStatus: toStatus as never,
      },
      select: { id: true },
    });
  },

  async updateDeadline(id: string, deadline: Date | null) {
    return prisma.ticket.update({
      where: { id },
      data: { deadline, updatedAt: new Date() },
      select: { id: true, deadline: true },
    });
  },

  async cancelWithNote(ticketId: string, reason: string, fromStatus: string) {
    return prisma.$transaction(async (tx) => {
      await tx.ticketHistory.create({
        data: { ticketId, type: "NOTE", content: reason },
      });
      await tx.ticketHistory.create({
        data: {
          ticketId,
          type: "STATUS_CHANGE",
          fromStatus: fromStatus as never,
          toStatus: "CANCELLED",
        },
      });
      return tx.ticket.update({
        where: { id: ticketId },
        data: { status: "CANCELLED", updatedAt: new Date() },
        select: { id: true, status: true },
      });
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

  async createApproval(ticketId: string, requestedBy: string) {
    return prisma.ticketApproval.create({
      data: { ticketId, requestedBy },
      select: { id: true },
    });
  },

  async createApprovalAndUpdateStatus(ticketId: string, requestedBy: string) {
    return prisma.$transaction(async (tx) => {
      await tx.ticketApproval.create({ data: { ticketId, requestedBy } });
      return tx.ticket.update({
        where: { id: ticketId },
        data: { status: "AWAITING_APPROVAL", updatedAt: new Date() },
        select: { id: true, status: true, locationId: true, category: true },
      });
    });
  },

  async resolveApproval(
    approvalId: string,
    approverId: string,
    status: "APPROVED" | "DECLINED",
    notes?: string,
  ) {
    return prisma.ticketApproval.update({
      where: { id: approvalId },
      data: { approverId, status, notes, resolvedAt: new Date() },
      select: {
        id: true,
        status: true,
        ticket: { select: { id: true, locationId: true, assignedTo: true } },
        requester: { select: { id: true, name: true } },
      },
    });
  },

  async getPendingApproval(ticketId: string) {
    return prisma.ticketApproval.findFirst({
      where: { ticketId, status: "PENDING" },
      select: { id: true },
    });
  },
};

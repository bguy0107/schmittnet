import { randomBytes } from "crypto";
import { z } from "zod";
import { ticketRepository } from "@/src/repositories/ticket-repository";
import { locationRepository } from "@/src/repositories/location-repository";
import { userRepository } from "@/src/repositories/user-repository";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";
import { getSignedReadUrl } from "@/src/lib/minio";
import { notificationService } from "./notification-service";
import type { Role } from "@schmittnet/types";

export const submitTicketSchema = z.object({
  category: z.enum(["IT", "MAINTENANCE"]),
  description: z.string().min(10).max(2000),
  deadline: z.string().datetime().optional(),
  mediaKeys: z.array(z.string().min(1)).min(1).max(5),
});

export const createTicketSchema = z.object({
  locationId: z.string().uuid(),
  category: z.enum(["IT", "MAINTENANCE"]),
  description: z.string().min(10).max(2000),
  deadline: z.string().optional(),
  mediaKeys: z.array(z.string().min(1)).max(5).optional(),
});

export const statusTransitionSchema = z.object({
  status: z.enum(["IN_PROGRESS", "ON_HOLD", "AWAITING_APPROVAL", "RESOLVED", "CANCELLED"]),
  onHoldReason: z.string().max(500).optional(),
  approvalReason: z.string().min(1).max(1000).optional(),
});

const ALLOWED_TRANSITIONS: Partial<Record<string, readonly string[]>> = {
  OPEN:               ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS:        ["ON_HOLD", "AWAITING_APPROVAL", "RESOLVED", "CANCELLED"],
  ON_HOLD:            ["IN_PROGRESS", "CANCELLED"],
  // AWAITING_APPROVAL exits via resolveApproval (APPROVED→RESOLVED, DECLINED→IN_PROGRESS).
  // Technicians may only cancel it directly.
  AWAITING_APPROVAL:  ["CANCELLED"],
  RESOLVED:           [],
  CANCELLED:          [],
};

export const ticketService = {
  async getLocationContext(token: string) {
    const location = await locationRepository.findByToken(token);
    if (!location) throw new NotFoundError("Location not found or QR code is inactive");
    return location;
  },

  async submitTicket(token: string, body: unknown) {
    const location = await this.getLocationContext(token);
    const data = submitTicketSchema.parse(body);

    const ticket = await ticketRepository.create({
      locationId: location.id,
      category: data.category,
      description: data.description,
      priority: "NORMAL",
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      mediaKeys: data.mediaKeys.map((key) => ({
        storageKey: key,
        mediaType: "PHOTO" as const,
        mimeType: "image/jpeg",
      })),
    });

    logger.info("Ticket submitted", {
      ticket_id: ticket.id,
      location_id: location.id,
      category: data.category,
    });

    await notificationService.enqueueTicketOpened(ticket.id, location.id, data.category);

    return {
      id: ticket.id,
      referenceCode: ticket.id.slice(0, 8).toUpperCase(),
    };
  },

  async createTicket(actorId: string, actorRole: Role, actorOwnerId: string | null, body: unknown) {
    const data = createTicketSchema.parse(body);

    // Enforce location scope — same logic as listTickets
    let allowedLocationIds: string[] | undefined;
    if (actorRole === "OWNER" || actorRole === "OWNER_STAFF") {
      if (!actorOwnerId) throw new ForbiddenError("No owner context");
      allowedLocationIds = await locationRepository.getLocationIdsByOwner(actorOwnerId);
    } else if (actorRole === "TECHNICIAN") {
      const user = await userRepository.findById(actorId);
      if (user?.ownerId) {
        allowedLocationIds = await locationRepository.getLocationIdsByOwner(user.ownerId);
      }
    }

    if (allowedLocationIds && !allowedLocationIds.includes(data.locationId)) {
      throw new ForbiddenError("Location is not within your scope");
    }

    const location = await locationRepository.findById(data.locationId);
    if (!location) throw new NotFoundError("Location not found");

    const ticket = await ticketRepository.create({
      locationId: data.locationId,
      category: data.category,
      description: data.description,
      priority: "NORMAL",
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      mediaKeys: (data.mediaKeys ?? []).map((key) => ({
        storageKey: key,
        mediaType: "PHOTO" as const,
        mimeType: "image/jpeg",
      })),
      actorId,
    });

    logger.info("Ticket created by staff", {
      ticket_id: ticket.id,
      location_id: data.locationId,
      actor_id: actorId,
      category: data.category,
    });

    await notificationService.enqueueTicketOpened(ticket.id, data.locationId, data.category);

    return { id: ticket.id, referenceCode: ticket.id.slice(0, 8).toUpperCase() };
  },

  async listTickets(actorId: string, actorRole: Role, actorOwnerId: string | null, filter: {
    status?: string;
    category?: string;
    locationId?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    let locationIds: string[] | undefined;

    if (actorRole === "OWNER" || actorRole === "OWNER_STAFF") {
      if (!actorOwnerId) throw new ForbiddenError("No owner context");
      locationIds = await locationRepository.getLocationIdsByOwner(actorOwnerId);
    } else if (actorRole === "TECHNICIAN") {
      const user = await userRepository.findById(actorId);
      if (user?.ownerId) {
        locationIds = await locationRepository.getLocationIdsByOwner(user.ownerId);
      }
    }
    // SUPER_ADMIN sees all — locationIds stays undefined

    if (filter.locationId) {
      if (locationIds) {
        locationIds = locationIds.includes(filter.locationId) ? [filter.locationId] : [];
      } else {
        locationIds = [filter.locationId];
      }
    }

    return ticketRepository.findMany({
      locationIds,
      status: filter.status as never,
      category: filter.category as never,
      search: filter.search,
      page: filter.page,
      pageSize: filter.pageSize,
    });
  },

  async getTicketById(id: string, actorRole: Role, actorOwnerId: string | null) {
    const ticket = await ticketRepository.findById(id);
    if (!ticket) throw new NotFoundError("Ticket not found");

    if (actorRole === "OWNER" || actorRole === "OWNER_STAFF") {
      if (!actorOwnerId) throw new ForbiddenError("No owner context");
      const ownerIds = await locationRepository.getOwnerIdsByLocationIds([ticket.location.id]);
      if (!ownerIds.includes(actorOwnerId)) throw new ForbiddenError("Access denied");
    }

    return ticket;
  },

  async updateStatus(
    ticketId: string,
    actorId: string,
    actorRole: Role,
    body: unknown,
  ) {
    if (actorRole !== "TECHNICIAN" && actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only technicians may update ticket status");
    }

    const data = statusTransitionSchema.parse(body);

    const current = await ticketRepository.findById(ticketId);
    if (!current) throw new NotFoundError("Ticket not found");

    const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(data.status)) {
      throw new ValidationError(`Cannot transition from ${current.status} to ${data.status}`);
    }

    let ticket: Awaited<ReturnType<typeof ticketRepository.updateStatus>>;

    if (data.status === "AWAITING_APPROVAL") {
      const existing = await ticketRepository.getPendingApproval(ticketId);
      if (existing) throw new ConflictError("A pending approval request already exists");
      ticket = await ticketRepository.createApprovalAndUpdateStatus(ticketId, actorId, data.approvalReason);
    } else {
      ticket = await ticketRepository.updateStatus(ticketId, data.status, {
        ...(data.status === "RESOLVED" ? { resolvedAt: new Date() } : {}),
        ...(data.status === "ON_HOLD" ? { onHoldReason: data.onHoldReason } : {}),
      });
    }

    await ticketRepository.addStatusChange(ticketId, actorId, current.status, data.status);

    logger.info("Ticket status updated", {
      ticket_id: ticketId,
      from_status: current.status,
      to_status: data.status,
      actor_id: actorId,
    });

    if (data.status === "IN_PROGRESS" && current.status === "OPEN") {
      await notificationService.enqueueTicketClaimed(ticketId, ticket.category);
    }
    if (data.status === "AWAITING_APPROVAL") {
      await notificationService.enqueueAwaitingApproval(ticketId, ticket.locationId);
    }
    if (data.status === "RESOLVED") {
      await notificationService.enqueueResolved(ticketId, ticket.locationId);
    }

    return ticket;
  },

  async addNote(ticketId: string, actorId: string, actorRole: Role, actorOwnerId: string | null, body: unknown) {
    if (actorRole !== "TECHNICIAN" && actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only technicians may add notes");
    }

    if (actorRole === "TECHNICIAN" && actorOwnerId) {
      const allowedLocationIds = await locationRepository.getLocationIdsByOwner(actorOwnerId);
      const ticket = await ticketRepository.findById(ticketId);
      if (!ticket || !allowedLocationIds.includes(ticket.location.id)) {
        throw new ForbiddenError("Access denied");
      }
    }

    const { content } = z
      .object({ content: z.string().min(1).max(2000) })
      .parse(body);

    return ticketRepository.addHistoryNote(ticketId, actorId, content);
  },

  async requestApproval(ticketId: string, actorId: string, actorRole: Role) {
    if (actorRole !== "TECHNICIAN" && actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only technicians may request approval");
    }

    const existing = await ticketRepository.getPendingApproval(ticketId);
    if (existing) throw new ConflictError("A pending approval already exists for this ticket");

    const approval = await ticketRepository.createApproval(ticketId, actorId);
    await ticketRepository.updateStatus(ticketId, "AWAITING_APPROVAL");

    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError("Ticket not found");

    await notificationService.enqueueAwaitingApproval(ticketId, ticket.location.id);

    return approval;
  },

  async resolveApproval(
    ticketId: string,
    approvalId: string,
    actorId: string,
    actorRole: Role,
    body: unknown,
  ) {
    if (actorRole !== "OWNER" && actorRole !== "OWNER_STAFF" && actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only owners may resolve approvals");
    }

    const { status, notes } = z
      .object({
        status: z.enum(["APPROVED", "DECLINED"]),
        notes: z.string().max(1000).optional(),
      })
      .parse(body);

    const result = await ticketRepository.resolveApproval(approvalId, actorId, ticketId, status, notes);

    if (status === "APPROVED") {
      await notificationService.enqueueResolved(ticketId, result.ticket.locationId);
    }

    logger.info("Approval resolved", {
      ticket_id: ticketId,
      approval_id: approvalId,
      status,
      approver_id: actorId,
    });

    await notificationService.enqueueApprovalDecision(
      ticketId,
      result.requester.id,
      status,
    );

    return result;
  },

  async getPublicTicketDetail(token: string, ticketId: string) {
    const location = await this.getLocationContext(token);
    const ticket = await ticketRepository.findByIdAndLocation(ticketId, location.id);
    if (!ticket) throw new NotFoundError("Ticket not found");

    const media = await Promise.all(
      ticket.media.map(async (m) => ({
        ...m,
        signedUrl: await getSignedReadUrl(m.storageKey),
      })),
    );

    return { ...ticket, media };
  },

  async addPublicNote(token: string, ticketId: string, body: unknown) {
    const { content, mediaKeys } = z.object({
      content: z.string().min(1).max(2000),
      mediaKeys: z.array(z.string().min(1)).max(5).optional(),
    }).parse(body);

    const location = await this.getLocationContext(token);
    const ticket = await ticketRepository.findByIdAndLocation(ticketId, location.id);
    if (!ticket) throw new NotFoundError("Ticket not found");
    if (ticket.status === "CANCELLED" || ticket.status === "RESOLVED") {
      throw new ValidationError("Cannot add notes to a closed ticket");
    }

    const note = await ticketRepository.addHistoryNote(ticketId, null, content);

    if (mediaKeys && mediaKeys.length > 0) {
      await Promise.all(
        mediaKeys.map((key) =>
          ticketRepository.addMedia(ticketId, key),
        ),
      );
    }

    return note;
  },

  async cancelPublicTicket(token: string, ticketId: string, body: unknown) {
    const { reason } = z.object({
      reason: z.string().min(1).max(500),
    }).parse(body);

    const location = await this.getLocationContext(token);
    const ticket = await ticketRepository.findByIdAndLocation(ticketId, location.id);
    if (!ticket) throw new NotFoundError("Ticket not found");
    if (ticket.status !== "OPEN") {
      throw new ValidationError("Only OPEN tickets can be cancelled by staff");
    }

    const result = await ticketRepository.cancelWithNote(ticketId, reason, ticket.status);

    logger.info("Ticket cancelled by public user", { ticket_id: ticketId, location_id: location.id });

    return result;
  },

  async updatePublicDeadline(token: string, ticketId: string, body: unknown) {
    const { deadline } = z.object({
      deadline: z.string().datetime().nullable(),
    }).parse(body);

    const location = await this.getLocationContext(token);
    const ticket = await ticketRepository.findByIdAndLocation(ticketId, location.id);
    if (!ticket) throw new NotFoundError("Ticket not found");
    if (ticket.status === "CANCELLED" || ticket.status === "RESOLVED") {
      throw new ValidationError("Cannot update deadline on a closed ticket");
    }

    return ticketRepository.updateDeadline(ticketId, deadline ? new Date(deadline) : null);
  },

  async getPublicTickets(token: string) {
    const location = await this.getLocationContext(token);
    const { rows } = await ticketRepository.findMany({
      locationIds: [location.id],
      pageSize: 50,
    });
    return {
      locationName: location.name,
      tickets: rows
        .filter((t) => t.status !== "CANCELLED")
        .map((t) => ({
          id: t.id,
          referenceCode: t.id.slice(0, 8).toUpperCase(),
          category: t.category,
          status: t.status,
          description: t.description.slice(0, 120),
          createdAt: t.createdAt,
        })),
    };
  },

  async claimTicket(ticketId: string, actorId: string, actorRole: Role) {
    if (actorRole !== "TECHNICIAN" && actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only technicians may claim tickets");
    }

    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw new NotFoundError("Ticket not found");
    if (ticket.assignee) throw new ConflictError("Ticket is already assigned");

    return ticketRepository.assign(ticketId, actorId);
  },
};

// Needed so notification-service can import without circular dep issues
export const generateQrToken = () => randomBytes(32).toString("hex");

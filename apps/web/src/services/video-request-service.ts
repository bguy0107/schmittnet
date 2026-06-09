import { z } from "zod";
import { videoRequestRepository } from "@/src/repositories/video-request-repository";
import { locationRepository } from "@/src/repositories/location-repository";
import { NotFoundError, ForbiddenError, ValidationError } from "@/src/lib/errors";
import { logger } from "@/src/lib/logger";
import { notificationService } from "./notification-service";
import type { Role } from "@schmittnet/types";

const videoRequestBaseSchema = z.object({
  cameraAreas: z.string().min(1).max(500),
  footageStart: z.string().datetime(),
  footageEnd: z.string().datetime(),
  requestingParty: z.enum(["LAW_ENFORCEMENT", "INTERNAL"]),
  officerContactDetails: z.string().min(1).max(500).optional(),
  internalContactDetails: z.string().min(1).max(500).optional(),
  submitterName: z.string().min(1).max(100),
  submitterContact: z.string().min(1).max(200),
});

function videoRequestRefineFn(
  data: { requestingParty: string; officerContactDetails?: string; internalContactDetails?: string; footageStart: string; footageEnd: string },
  ctx: z.RefinementCtx,
) {
  if (data.requestingParty === "LAW_ENFORCEMENT") {
    if (!data.officerContactDetails?.trim()) {
      ctx.addIssue({ code: "custom", path: ["officerContactDetails"], message: "Officer contact details are required for law enforcement requests" });
    }
  }
  if (data.requestingParty === "INTERNAL") {
    if (!data.internalContactDetails?.trim()) {
      ctx.addIssue({ code: "custom", path: ["internalContactDetails"], message: "Internal contact details are required for internal requests" });
    }
  }
  if (new Date(data.footageEnd) <= new Date(data.footageStart)) {
    ctx.addIssue({ code: "custom", path: ["footageEnd"], message: "Footage end must be after footage start" });
  }
}

export const submitVideoRequestSchema = videoRequestBaseSchema.superRefine(videoRequestRefineFn);

export const createVideoRequestSchema = videoRequestBaseSchema
  .extend({ locationId: z.string().uuid(), submitterContact: z.string().max(200).optional() })
  .superRefine(videoRequestRefineFn);

export const resolveVideoRequestSchema = z.object({
  resolutionNote: z.string().min(1).max(2000),
});

export const cancelVideoRequestSchema = z.object({
  note: z.string().max(500).optional(),
});

async function assertOwnerScope(locationId: string, actorRole: Role, actorOwnerId: string | null) {
  if (actorRole === "SUPER_ADMIN") return;
  if (!actorOwnerId) throw new ForbiddenError("Access denied");
  const ownerIds = await locationRepository.getOwnerIdsByLocationIds([locationId]);
  if (!ownerIds.includes(actorOwnerId)) throw new ForbiddenError("Access denied");
}

export const videoRequestService = {
  async getLocationContext(token: string) {
    const location = await locationRepository.findByToken(token);
    if (!location) throw new NotFoundError("Location not found or QR code is inactive");
    return location;
  },

  async submitVideoRequest(token: string, body: unknown) {
    const location = await this.getLocationContext(token);
    const data = submitVideoRequestSchema.parse(body);

    const request = await videoRequestRepository.create({
      locationId: location.id,
      cameraAreas: data.cameraAreas,
      footageStart: new Date(data.footageStart),
      footageEnd: new Date(data.footageEnd),
      requestingParty: data.requestingParty,
      officerContactDetails: data.officerContactDetails,
      internalContactDetails: data.internalContactDetails,
      submitterName: data.submitterName,
      submitterContact: data.submitterContact,
      submittedById: null,
    });

    logger.info("Video request submitted via QR", {
      video_request_id: request.id,
      location_id: location.id,
      requesting_party: data.requestingParty,
    });

    await notificationService.enqueueVideoRequestOpened(request.id, location.id);

    return {
      id: request.id,
      referenceCode: request.id.slice(0, 8).toUpperCase(),
    };
  },

  async createVideoRequest(actorId: string, actorEmail: string, actorRole: Role, actorOwnerId: string | null, body: unknown) {
    const data = createVideoRequestSchema.parse(body);

    let allowedLocationIds: string[] | undefined;
    if (actorRole === "OWNER" || actorRole === "OWNER_STAFF") {
      if (!actorOwnerId) throw new ForbiddenError("No owner context");
      allowedLocationIds = await locationRepository.getLocationIdsByOwner(actorOwnerId);
    } else if (actorRole === "TECHNICIAN") {
      if (!actorOwnerId) throw new ForbiddenError("Access denied");
      allowedLocationIds = await locationRepository.getLocationIdsByOwner(actorOwnerId);
    }

    if (allowedLocationIds && !allowedLocationIds.includes(data.locationId)) {
      throw new ForbiddenError("Location is not within your scope");
    }

    const location = await locationRepository.findById(data.locationId);
    if (!location) throw new NotFoundError("Location not found");

    const request = await videoRequestRepository.create({
      locationId: data.locationId,
      cameraAreas: data.cameraAreas,
      footageStart: new Date(data.footageStart),
      footageEnd: new Date(data.footageEnd),
      requestingParty: data.requestingParty,
      officerContactDetails: data.officerContactDetails,
      internalContactDetails: data.internalContactDetails,
      submitterName: data.submitterName,
      submitterContact: data.submitterContact ?? actorEmail,
      submittedById: actorId,
    });

    logger.info("Video request created by authenticated user", {
      video_request_id: request.id,
      location_id: data.locationId,
      actor_id: actorId,
    });

    await notificationService.enqueueVideoRequestOpened(request.id, data.locationId);

    return {
      id: request.id,
      referenceCode: request.id.slice(0, 8).toUpperCase(),
    };
  },

  async listVideoRequests(actorId: string, actorRole: Role, actorOwnerId: string | null, filter: {
    status?: string;
    locationId?: string;
    page?: number;
    pageSize?: number;
  }) {
    let locationIds: string[] | undefined;

    if (actorRole === "OWNER" || actorRole === "OWNER_STAFF") {
      if (!actorOwnerId) throw new ForbiddenError("No owner context");
      locationIds = await locationRepository.getLocationIdsByOwner(actorOwnerId);
    } else if (actorRole === "TECHNICIAN") {
      if (!actorOwnerId) throw new ForbiddenError("Access denied");
      locationIds = await locationRepository.getLocationIdsByOwner(actorOwnerId);
    }

    if (filter.locationId) {
      if (locationIds) {
        locationIds = locationIds.includes(filter.locationId) ? [filter.locationId] : [];
      } else {
        locationIds = [filter.locationId];
      }
    }

    return videoRequestRepository.findMany({
      locationIds,
      status: filter.status as never,
      page: filter.page,
      pageSize: filter.pageSize,
    });
  },

  async getVideoRequestById(id: string, actorRole: Role, actorOwnerId: string | null) {
    const request = await videoRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Video request not found");

    await assertOwnerScope(request.location.id, actorRole, actorOwnerId);

    return request;
  },

  async resolveVideoRequest(id: string, actorId: string, actorRole: Role, actorOwnerId: string | null, body: unknown) {
    if (actorRole !== "SUPER_ADMIN" && actorRole !== "TECHNICIAN") {
      throw new ForbiddenError("Only IT technicians may resolve video requests");
    }

    const { resolutionNote } = resolveVideoRequestSchema.parse(body);

    const request = await videoRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Video request not found");

    await assertOwnerScope(request.location.id, actorRole, actorOwnerId);

    if (request.status !== "OPEN") {
      throw new ValidationError(`Cannot resolve a request in ${request.status} status`);
    }

    const result = await videoRequestRepository.resolve(id, actorId, resolutionNote);

    logger.info("Video request resolved", {
      video_request_id: id,
      actor_id: actorId,
    });

    return result;
  },

  async cancelVideoRequest(id: string, actorId: string, actorRole: Role, actorOwnerId: string | null, body: unknown) {
    const { note } = cancelVideoRequestSchema.parse(body);

    const request = await videoRequestRepository.findById(id);
    if (!request) throw new NotFoundError("Video request not found");

    if (actorRole !== "SUPER_ADMIN") {
      await assertOwnerScope(request.location.id, actorRole, actorOwnerId);
    }

    if (request.status !== "OPEN") {
      throw new ValidationError(`Cannot cancel a request in ${request.status} status`);
    }

    const result = await videoRequestRepository.cancel(id, actorId, note ?? null);

    logger.info("Video request cancelled", {
      video_request_id: id,
      actor_id: actorId,
    });

    return result;
  },

  async cancelPublicVideoRequest(token: string, id: string, body: unknown) {
    const { note } = cancelVideoRequestSchema.parse(body);
    const location = await this.getLocationContext(token);

    const request = await videoRequestRepository.findByIdAndLocation(id, location.id);
    if (!request) throw new NotFoundError("Video request not found");

    if (request.status !== "OPEN") {
      throw new ValidationError(`Cannot cancel a request in ${request.status} status`);
    }

    const result = await videoRequestRepository.cancel(id, null, note ?? null);

    logger.info("Video request cancelled via public QR path", {
      video_request_id: id,
      location_id: location.id,
    });

    return result;
  },
};

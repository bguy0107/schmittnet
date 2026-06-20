import { randomBytes } from "crypto";
import { z } from "zod";
import { locationRepository } from "@/src/repositories/location-repository";
import { ForbiddenError, NotFoundError } from "@/src/lib/errors";
import type { Role } from "@schmittnet/types";

const createLocationSchema = z.object({
  name: z.string().min(2).max(100),
  locationNumber: z.number().int().positive(),
  // Owner.id is a free-form string PK (seed data overrides the uuid() default
  // with human-readable ids), so don't require uuid format here.
  ownerId: z.string().min(1),
  address: z.string().max(200).optional(),
});

const updateLocationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  locationNumber: z.number().int().positive().optional(),
  address: z.string().max(200).optional(),
  qrActive: z.boolean().optional(),
  regenerateToken: z.boolean().optional(),
});

export const locationService = {
  async listLocations(actorRole: Role, actorOwnerId: string | null) {
    if (actorRole === "OWNER" || actorRole === "OWNER_STAFF") {
      if (!actorOwnerId) throw new ForbiddenError("No owner context");
      return locationRepository.findAll(actorOwnerId);
    }
    return locationRepository.findAll();
  },

  async createLocation(actorRole: Role, body: unknown) {
    if (actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only super-admins may create locations");
    }

    const data = createLocationSchema.parse(body);
    const qrToken = randomBytes(32).toString("hex");

    return locationRepository.create({ ...data, qrToken });
  },

  async getLocation(id: string, actorRole: Role) {
    if (actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only super-admins may view location details");
    }
    const location = await locationRepository.findById(id);
    if (!location) throw new NotFoundError("Location not found");
    return location;
  },

  async deleteLocation(id: string, actorRole: Role) {
    if (actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only super-admins may delete locations");
    }

    const existing = await locationRepository.findById(id);
    if (!existing) throw new NotFoundError("Location not found");

    await locationRepository.deleteWithCascade(id);
  },

  async updateLocation(id: string, actorRole: Role, body: unknown) {
    if (actorRole !== "SUPER_ADMIN") {
      throw new ForbiddenError("Only super-admins may update locations");
    }

    const existing = await locationRepository.findById(id);
    if (!existing) throw new NotFoundError("Location not found");

    const data = updateLocationSchema.parse(body);
    const { regenerateToken, ...rest } = data;

    const updates: Parameters<typeof locationRepository.update>[1] = { ...rest };
    if (regenerateToken) {
      updates.qrToken = randomBytes(32).toString("hex");
    }

    return locationRepository.update(id, updates);
  },
};

import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { prisma } from "@/src/lib/prisma";
import { userRepository } from "@/src/repositories/user-repository";
import { locationRepository } from "@/src/repositories/location-repository";
import { notificationService } from "@/src/services/notification-service";
import { ForbiddenError, NotFoundError, ConflictError, ValidationError } from "@/src/lib/errors";
import type { Role } from "@schmittnet/types";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(["SUPER_ADMIN", "OWNER", "OWNER_STAFF", "TECHNICIAN"]),
  categories: z.array(z.enum(["IT", "MAINTENANCE"])).optional(),
  // Owner.id is a free-form string PK (seed data overrides the uuid() default
  // with human-readable ids), so don't require uuid format here.
  ownerId: z.string().min(1).optional(),
  password: z.string().min(8),
  notificationEmail: z.boolean().default(false),
  assignedLocationIds: z.array(z.string().uuid()).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "OWNER_STAFF", "TECHNICIAN"]).optional(),
  categories: z.array(z.enum(["IT", "MAINTENANCE"])).optional(),
  ownerId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
  notificationEmail: z.boolean().optional(),
  password: z.string().min(8).optional(),
  assignedLocationIds: z.array(z.string().uuid()).optional(),
});

// Per-location approval-authority assignment only applies to OWNER_STAFF; an
// empty/omitted list means "all of the owner's locations" (see
// ticket-service.resolveApproval). Any other role gets its assignments cleared
// so stale rows don't linger after a role change.
async function syncAssignedLocations(
  userId: string,
  role: Role,
  ownerId: string | null,
  assignedLocationIds?: string[],
) {
  if (role !== "OWNER_STAFF") {
    await userRepository.setAssignedLocations(userId, []);
    return;
  }
  if (assignedLocationIds === undefined) return;
  if (assignedLocationIds.length === 0) {
    await userRepository.setAssignedLocations(userId, []);
    return;
  }

  if (!ownerId) throw new ValidationError("Cannot assign locations without an owner");
  const validIds = await locationRepository.getLocationIdsByOwner(ownerId);
  const invalid = assignedLocationIds.filter((id) => !validIds.includes(id));
  if (invalid.length > 0) throw new ValidationError("One or more locations do not belong to this owner");

  await userRepository.setAssignedLocations(userId, assignedLocationIds);
}

export const userService = {
  async listUsers(actorRole: Role) {
    if (actorRole !== "SUPER_ADMIN") throw new ForbiddenError("Super-admin access required");
    return userRepository.findAll();
  },

  async createUser(actorRole: Role, body: unknown) {
    if (actorRole !== "SUPER_ADMIN") throw new ForbiddenError("Super-admin access required");

    const data = createUserSchema.parse(body);

    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new ConflictError("A user with this email already exists");

    const passwordHash = await hash(data.password);

    let ownerId = data.ownerId;
    if (data.role === "OWNER" && !ownerId) {
      const owner = await prisma.owner.create({ data: { name: data.name } });
      ownerId = owner.id;
    }

    const user = await userRepository.create({
      email: data.email,
      name: data.name,
      role: data.role as Role,
      categories: data.categories as never,
      ownerId,
      passwordHash,
      notificationEmail: data.notificationEmail,
    });

    await syncAssignedLocations(user.id, data.role as Role, ownerId ?? null, data.assignedLocationIds);

    await notificationService.enqueueUserWelcome(data.email, data.name, data.password);

    return user;
  },

  async deleteUser(id: string, actorRole: Role, actorId: string) {
    if (actorRole !== "SUPER_ADMIN") throw new ForbiddenError("Super-admin access required");

    const existing = await userRepository.findById(id);
    if (!existing) throw new NotFoundError("User not found");

    if (existing.isActive) throw new ConflictError("Deactivate the user before deleting");

    if (id === actorId) throw new ForbiddenError("Cannot delete your own account");

    await userRepository.cleanupBeforeDeletion(id);
    await userRepository.delete(id);
  },

  async updateUser(id: string, actorRole: Role, body: unknown) {
    if (actorRole !== "SUPER_ADMIN") throw new ForbiddenError("Super-admin access required");

    const existing = await userRepository.findById(id);
    if (!existing) throw new NotFoundError("User not found");

    const data = updateUserSchema.parse(body);

    const updates: Parameters<typeof userRepository.update>[1] = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.role !== undefined) updates.role = data.role as Role;
    if (data.categories !== undefined) updates.categories = data.categories as never;
    if (data.ownerId !== undefined) updates.ownerId = data.ownerId;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.notificationEmail !== undefined) updates.notificationEmail = data.notificationEmail;

    if (data.password) {
      updates.passwordHash = await hash(data.password);
    }

    const effectiveRole = (updates.role ?? existing.role) as Role;
    const effectiveOwnerId = updates.ownerId !== undefined ? updates.ownerId : existing.ownerId;
    if (effectiveRole === "OWNER" && !effectiveOwnerId) {
      const ownerName = updates.name ?? existing.name ?? existing.email;
      const owner = await prisma.owner.create({ data: { name: ownerName } });
      updates.ownerId = owner.id;
    }

    const user = await userRepository.update(id, updates);

    if (data.assignedLocationIds !== undefined || (existing.role === "OWNER_STAFF" && effectiveRole !== "OWNER_STAFF")) {
      await syncAssignedLocations(id, effectiveRole, effectiveOwnerId, data.assignedLocationIds);
    }

    if (data.isActive === false && existing.isActive) {
      await userRepository.unassignAndReopenTickets(id);
    }

    return user;
  },
};

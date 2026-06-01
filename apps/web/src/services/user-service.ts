import { z } from "zod";
import { hash } from "@node-rs/argon2";
import { userRepository } from "@/src/repositories/user-repository";
import { ForbiddenError, NotFoundError, ConflictError } from "@/src/lib/errors";
import type { Role } from "@schmittnet/types";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(["SUPER_ADMIN", "OWNER", "OWNER_STAFF", "TECHNICIAN"]),
  categories: z.array(z.enum(["IT", "MAINTENANCE"])).optional(),
  ownerId: z.string().uuid().optional(),
  password: z.string().min(12),
  notificationDiscord: z.string().url().optional(),
  notificationEmail: z.boolean().default(true),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(["SUPER_ADMIN", "OWNER", "OWNER_STAFF", "TECHNICIAN"]).optional(),
  categories: z.array(z.enum(["IT", "MAINTENANCE"])).optional(),
  ownerId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  notificationDiscord: z.string().url().nullable().optional(),
  notificationEmail: z.boolean().optional(),
  password: z.string().min(12).optional(),
});

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

    return userRepository.create({
      email: data.email,
      name: data.name,
      role: data.role as Role,
      categories: data.categories as never,
      ownerId: data.ownerId,
      passwordHash,
      notificationDiscord: data.notificationDiscord,
      notificationEmail: data.notificationEmail,
    });
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
    if (data.notificationDiscord !== undefined) updates.notificationDiscord = data.notificationDiscord;
    if (data.notificationEmail !== undefined) updates.notificationEmail = data.notificationEmail;

    if (data.password) {
      updates.passwordHash = await hash(data.password);
    }

    return userRepository.update(id, updates);
  },
};

import { z } from "zod";
import { hash, verify } from "@node-rs/argon2";
import { userRepository } from "@/src/repositories/user-repository";
import { UnauthorizedError, ValidationError } from "@/src/lib/errors";

const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  notificationEmail: z.boolean().optional(),
  notificationDiscord: z.string().url().nullable().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, "Password must be at least 12 characters"),
});

export const profileService = {
  async getProfile(userId: string) {
    return userRepository.findById(userId);
  },

  async updateProfile(userId: string, body: unknown) {
    const data = updateProfileSchema.parse(body);

    const updates: Parameters<typeof userRepository.update>[1] = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.notificationEmail !== undefined) updates.notificationEmail = data.notificationEmail;
    if (data.notificationDiscord !== undefined) updates.notificationDiscord = data.notificationDiscord;

    return userRepository.update(userId, updates);
  },

  async changePassword(userId: string, body: unknown) {
    const data = changePasswordSchema.parse(body);

    const user = await userRepository.findByIdWithHash(userId);
    if (!user) throw new UnauthorizedError();

    const valid = await verify(user.passwordHash, data.currentPassword).catch(() => false);
    if (!valid) throw new ValidationError("Current password is incorrect");

    if (data.newPassword === data.currentPassword) {
      throw new ValidationError("New password must differ from the current password");
    }

    await userRepository.update(userId, { passwordHash: await hash(data.newPassword) });
  },
};

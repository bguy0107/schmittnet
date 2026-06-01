import { z } from "zod";
import { settingRepository } from "@/src/repositories/setting-repository";
import { ForbiddenError } from "@/src/lib/errors";
import type { Role } from "@schmittnet/types";

export const discordSettingsSchema = z.object({
  category: z.enum(["IT", "MAINTENANCE"]),
  webhookUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
  roleId: z.string().regex(/^\d+$/, "Must be a numeric Discord role ID").or(z.literal("")).optional(),
});

const KEY = {
  IT: "discord_webhook_it",
  MAINTENANCE: "discord_webhook_maintenance",
  ROLE_IT: "discord_role_it",
  ROLE_MAINTENANCE: "discord_role_maintenance",
} as const;

export const settingsService = {
  async getDiscordSettings(actorRole: Role) {
    if (actorRole !== "SUPER_ADMIN") throw new ForbiddenError("Super admin only");
    const [it, maintenance, roleIt, roleMaintenance] = await Promise.all([
      settingRepository.get(KEY.IT),
      settingRepository.get(KEY.MAINTENANCE),
      settingRepository.get(KEY.ROLE_IT),
      settingRepository.get(KEY.ROLE_MAINTENANCE),
    ]);
    return {
      IT: it,
      MAINTENANCE: maintenance,
      ROLE_IT: roleIt,
      ROLE_MAINTENANCE: roleMaintenance,
    };
  },

  async updateDiscordWebhook(actorRole: Role, body: unknown) {
    if (actorRole !== "SUPER_ADMIN") throw new ForbiddenError("Super admin only");
    const { category, webhookUrl, roleId } = discordSettingsSchema.parse(body);
    if (webhookUrl !== undefined) {
      const key = KEY[category];
      if (webhookUrl) {
        await settingRepository.upsert(key, webhookUrl);
      } else {
        await settingRepository.delete(key);
      }
    }
    if (roleId !== undefined) {
      const roleKey = category === "IT" ? KEY.ROLE_IT : KEY.ROLE_MAINTENANCE;
      if (roleId) {
        await settingRepository.upsert(roleKey, roleId);
      } else {
        await settingRepository.delete(roleKey);
      }
    }
  },
};

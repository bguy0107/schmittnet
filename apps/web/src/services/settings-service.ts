import { z } from "zod";
import { settingRepository } from "@/src/repositories/setting-repository";
import { ForbiddenError } from "@/src/lib/errors";
import type { Role } from "@schmittnet/types";

export const discordSettingsSchema = z.object({
  category: z.enum(["IT", "MAINTENANCE"]),
  webhookUrl: z.string().url("Must be a valid URL").or(z.literal("")),
});

const KEY = {
  IT: "discord_webhook_it",
  MAINTENANCE: "discord_webhook_maintenance",
} as const;

export const settingsService = {
  async getDiscordSettings(actorRole: Role) {
    if (actorRole !== "SUPER_ADMIN") throw new ForbiddenError("Super admin only");
    const [it, maintenance] = await Promise.all([
      settingRepository.get(KEY.IT),
      settingRepository.get(KEY.MAINTENANCE),
    ]);
    return { IT: it, MAINTENANCE: maintenance };
  },

  async updateDiscordWebhook(actorRole: Role, body: unknown) {
    if (actorRole !== "SUPER_ADMIN") throw new ForbiddenError("Super admin only");
    const { category, webhookUrl } = discordSettingsSchema.parse(body);
    const key = KEY[category];
    if (webhookUrl) {
      await settingRepository.upsert(key, webhookUrl);
    } else {
      await settingRepository.delete(key);
    }
  },
};

import { prisma } from "@/src/lib/prisma";
import type { Category } from "@schmittnet/types";

const DISCORD_WEBHOOK_KEY: Record<Category, string> = {
  IT: "discord_webhook_it",
  MAINTENANCE: "discord_webhook_maintenance",
};

export const settingRepository = {
  async get(key: string): Promise<string | null> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  },

  async upsert(key: string, value: string): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  },

  async delete(key: string): Promise<void> {
    await prisma.setting.deleteMany({ where: { key } });
  },

  async getDiscordWebhook(category: Category): Promise<string | null> {
    return this.get(DISCORD_WEBHOOK_KEY[category]);
  },
};

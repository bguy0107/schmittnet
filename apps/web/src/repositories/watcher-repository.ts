import { prisma } from "@/src/lib/prisma";

export const watcherRepository = {
  async findByTicket(ticketId: string) {
    return prisma.ticketWatcher.findMany({
      where: { ticketId },
      select: { userId: true, webhookUrl: true },
    });
  },

  async findOne(ticketId: string, userId: string) {
    return prisma.ticketWatcher.findUnique({
      where: { ticketId_userId: { ticketId, userId } },
      select: { id: true, webhookUrl: true },
    });
  },

  async upsert(ticketId: string, userId: string, webhookUrl: string) {
    return prisma.ticketWatcher.upsert({
      where: { ticketId_userId: { ticketId, userId } },
      create: { ticketId, userId, webhookUrl },
      update: { webhookUrl },
      select: { id: true },
    });
  },

  async remove(ticketId: string, userId: string) {
    await prisma.ticketWatcher.deleteMany({ where: { ticketId, userId } });
  },
};

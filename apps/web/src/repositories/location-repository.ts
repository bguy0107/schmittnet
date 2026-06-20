import { prisma } from "@/src/lib/prisma";
import type { Prisma } from "@prisma/client";

const locationSelect = {
  id: true,
  name: true,
  locationNumber: true,
  address: true,
  qrToken: true,
  qrActive: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true } },
} satisfies Prisma.LocationSelect;

export type LocationRow = Prisma.LocationGetPayload<{ select: typeof locationSelect }>;

export const locationRepository = {
  async findAll(ownerId?: string) {
    return prisma.location.findMany({
      where: ownerId ? { ownerId } : undefined,
      select: locationSelect,
      orderBy: { name: "asc" },
    });
  },

  async findByToken(token: string) {
    return prisma.location.findUnique({
      where: { qrToken: token, qrActive: true },
      select: { id: true, name: true, ownerId: true },
    });
  },

  async findById(id: string) {
    return prisma.location.findUnique({
      where: { id },
      select: locationSelect,
    });
  },

  async create(data: {
    name: string;
    locationNumber?: number | null;
    ownerId: string;
    qrToken: string;
    address?: string;
  }) {
    return prisma.location.create({
      data,
      select: locationSelect,
    });
  },

  async update(
    id: string,
    data: Partial<{ name: string; locationNumber: number | null; address: string; qrToken: string; qrActive: boolean }>,
  ) {
    return prisma.location.update({
      where: { id },
      data,
      select: locationSelect,
    });
  },

  async getOwnerIdsByLocationIds(locationIds: string[]): Promise<string[]> {
    const rows = await prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { ownerId: true },
      distinct: ["ownerId"],
    });
    return rows.map((r) => r.ownerId);
  },

  async getLocationIdsByOwner(ownerId: string): Promise<string[]> {
    const rows = await prisma.location.findMany({
      where: { ownerId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },

  async deleteWithCascade(id: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const ticketIds = await tx.ticket
        .findMany({ where: { locationId: id }, select: { id: true } })
        .then((rows) => rows.map((r) => r.id));

      if (ticketIds.length > 0) {
        await tx.ticketApproval.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await tx.ticketHistory.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await tx.ticketMedia.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await tx.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      }

      await tx.location.delete({ where: { id } });
    });
  },
};

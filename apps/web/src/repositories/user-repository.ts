import { prisma } from "@/src/lib/prisma";
import type { Role, Category } from "@schmittnet/types";
import type { Prisma } from "@prisma/client";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  categories: true,
  notificationEmail: true,
  ownerId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

export const userRepository = {
  async findAll() {
    return prisma.user.findMany({
      select: userSelect,
      orderBy: { name: "asc" },
    });
  },

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });
  },

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: { ...userSelect, passwordHash: true },
    });
  },

  async findByIdWithHash(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { ...userSelect, passwordHash: true },
    });
  },

  async findTechniciansForCategory(category: Category) {
    return prisma.user.findMany({
      where: {
        role: "TECHNICIAN",
        isActive: true,
        categories: { has: category },
      },
      select: {
        id: true,
        name: true,
        email: true,
        notificationEmail: true,
      },
    });
  },

  async findOwnerStaffForOwner(ownerId: string) {
    return prisma.user.findMany({
      where: {
        ownerId,
        role: { in: ["OWNER", "OWNER_STAFF"] },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        notificationEmail: true,
      },
    });
  },

  async create(data: {
    email: string;
    name: string;
    role: Role;
    categories?: Category[];
    ownerId?: string;
    passwordHash: string;
    notificationEmail?: boolean;
  }) {
    return prisma.user.create({
      data,
      select: userSelect,
    });
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      role: Role;
      categories: Category[];
      ownerId: string | null;
      notificationEmail: boolean;
      isActive: boolean;
      passwordHash: string;
    }>,
  ) {
    return prisma.user.update({
      where: { id },
      data,
      select: userSelect,
    });
  },

  async deactivate(id: string) {
    await prisma.user.update({ where: { id }, data: { isActive: false } });
  },

  async unassignAndReopenTickets(userId: string) {
    await prisma.ticket.updateMany({
      where: { assignedTo: userId, status: { notIn: ["RESOLVED", "CANCELLED"] } },
      data: { assignedTo: null, status: "OPEN" },
    });
  },

  async hasAssociatedData(id: string) {
    const [tickets, notes, approvalsReq, approvalsAct] = await Promise.all([
      prisma.ticket.count({ where: { assignedTo: id } }),
      prisma.ticketHistory.count({ where: { authorId: id } }),
      prisma.ticketApproval.count({ where: { requestedBy: id } }),
      prisma.ticketApproval.count({ where: { approverId: id } }),
    ]);
    return tickets + notes + approvalsReq + approvalsAct > 0;
  },

  async cleanupBeforeDeletion(userId: string) {
    await prisma.$transaction([
      // requestedBy is non-nullable — must delete these rows or the user delete will fail
      prisma.ticketApproval.deleteMany({ where: { requestedBy: userId } }),
      // Clear any remaining ticket assignments (terminal tickets not touched by deactivation)
      prisma.ticket.updateMany({ where: { assignedTo: userId }, data: { assignedTo: null } }),
    ]);
  },

  async delete(id: string) {
    await prisma.user.delete({ where: { id } });
  },
};

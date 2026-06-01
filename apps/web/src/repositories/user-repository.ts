import { prisma } from "@/src/lib/prisma";
import type { Role, Category } from "@schmittnet/types";
import type { Prisma } from "@prisma/client";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  categories: true,
  notificationDiscord: true,
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
        notificationDiscord: true,
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
        notificationDiscord: true,
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
    notificationDiscord?: string;
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
      notificationDiscord: string | null;
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
};

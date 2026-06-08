import { prisma } from "@/src/lib/prisma";

const sessionWithUserSelect = {
  expires: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      ownerId: true,
      isActive: true,
    },
  },
} as const;

export const sessionRepository = {
  async create(data: { tokenHash: string; userId: string; expires: Date }) {
    return prisma.session.create({
      data: { sessionToken: data.tokenHash, userId: data.userId, expires: data.expires },
    });
  },

  async findByTokenHash(tokenHash: string) {
    return prisma.session.findUnique({
      where: { sessionToken: tokenHash },
      select: sessionWithUserSelect,
    });
  },

  async deleteByTokenHash(tokenHash: string) {
    await prisma.session.deleteMany({ where: { sessionToken: tokenHash } });
  },

  async deleteAllForUser(userId: string) {
    await prisma.session.deleteMany({ where: { userId } });
  },
};

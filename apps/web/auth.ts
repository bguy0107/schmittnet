import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { logger } from "@/src/lib/logger";
import { userRepository } from "@/src/repositories/user-repository";
import { authConfig } from "./auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            isActive: true,
            role: true,
            ownerId: true,
          },
        });

        if (!user || !user.isActive) return null;

        const passwordValid = await verify(user.passwordHash, parsed.data.password).catch(
          (err: unknown) => {
            logger.error("Password verification error", { error: String(err) });
            return false;
          },
        );
        if (!passwordValid) return null;

        await userRepository.recordLogin(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Custom fields passed to jwt callback
          role: user.role,
          ownerId: user.ownerId,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Fires on sign-in: persist role + ownerId into the JWT.
      if (user) {
        token.role = (user as { role: string }).role;
        token.ownerId = (user as { ownerId: string | null }).ownerId ?? null;
        token.sub = user.id;
      }
      return token;
    },

    async session({ session, token }) {
      // Re-verify the user is still active on every session access.
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { isActive: true, role: true, ownerId: true },
        });

        if (!dbUser?.isActive) {
          // Return an empty session — deactivated users get signed out on next request.
          return { ...session, user: { ...session.user, id: "" } };
        }

        session.user.id = token.sub;
        session.user.role = dbUser.role;
        session.user.ownerId = dbUser.ownerId;
      }
      return session;
    },
  },
});

import type { Role } from "@schmittnet/types";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string | null;
      role: Role;
      ownerId: string | null;
    };
  }
}

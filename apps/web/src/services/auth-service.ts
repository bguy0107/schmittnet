import { z } from "zod";
import { verify } from "@node-rs/argon2";
import { userRepository } from "@/src/repositories/user-repository";
import { logger } from "@/src/lib/logger";
import { UnauthorizedError } from "@/src/lib/errors";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authService = {
  async login(body: unknown) {
    const parsed = credentialsSchema.safeParse(body);
    // Same generic error for malformed input, unknown email, wrong password, or
    // a deactivated account — never reveal which one to an unauthenticated caller.
    if (!parsed.success) throw new UnauthorizedError("Invalid email or password");

    const user = await userRepository.findByEmail(parsed.data.email);
    if (!user || !user.isActive) throw new UnauthorizedError("Invalid email or password");

    const passwordValid = await verify(user.passwordHash, parsed.data.password).catch(
      (err: unknown) => {
        logger.error("Password verification error", { error: String(err) });
        return false;
      },
    );
    if (!passwordValid) throw new UnauthorizedError("Invalid email or password");

    await userRepository.recordLogin(user.id);

    return user;
  },
};

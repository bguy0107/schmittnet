import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().min(1),

  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z
    .string()
    .transform((v) => v === "true")
    .default("false"),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().default("tickets"),

  AUTH_SECRET: z.string().min(32),

  GMAIL_USER: z.preprocess(emptyToUndefined, z.string().email().optional()),
  GMAIL_APP_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),

  SENTRY_DSN: z.preprocess(emptyToUndefined, z.string().url().optional()),
});

// During Next.js static generation (next build), server modules are evaluated
// without real env vars. Defer validation to runtime so the build can complete.
// At runtime, the app fails fast on startup if anything is missing or invalid.
export const env =
  process.env.NEXT_PHASE === "phase-production-build"
    ? (process.env as unknown as z.infer<typeof envSchema>)
    : envSchema.parse(process.env);

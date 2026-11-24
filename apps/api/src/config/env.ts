import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  APP_URL: z.url(),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  INVITE_SECRET: z.string().min(32),
  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  API_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  CHECK_DISPATCH_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
  SILENCE_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  ALLOW_PRIVATE_NETWORK_TARGETS: z.stringbool().default(false),
  MAX_MONITORS_PER_WORKSPACE: z.coerce.number().int().positive().default(100),
  CHECK_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(20),
  CHECK_MAX_CONCURRENCY_PER_HOST: z.coerce.number().int().positive().default(4),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error(
    `Invalid environment variables:\n${z.prettifyError(result.error)}`,
  );
  process.exit(1);
}

export const env = result.data;

export const isProduction = env.NODE_ENV === "production";

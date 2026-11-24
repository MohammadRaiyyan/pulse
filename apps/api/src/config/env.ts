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
  WEBHOOK_MAX_BODY_BYTES: z.coerce.number().int().positive().default(262_144),
  WEBHOOK_INGEST_PER_SLUG_PER_MINUTE: z.coerce.number().int().positive().default(120),
  WEBHOOK_INGEST_PER_IP_PER_MINUTE: z.coerce.number().int().positive().default(600),
  WEBHOOK_EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  WEBHOOK_MAX_EVENTS_PER_ENDPOINT: z.coerce.number().int().positive().default(1_000),
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

import { z } from "zod";
import { parseTrustProxy } from "./trust-proxy.ts";

const emptyAsUnset = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value),
    schema.optional(),
  );

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const trustProxy = z
  .string()
  .default("loopback")
  .transform((value, context) => {
    const setting = parseTrustProxy(value);

    if (setting instanceof Error) {
      context.addIssue({ code: "custom", message: setting.message });
      return z.NEVER;
    }

    return setting;
  });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  APP_URL: z.url(),
  APP_VERSION: z.string().min(1).default("dev"),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  JWT_SECRET: z.string().min(32),
  INVITE_SECRET: z.string().min(32),
  COOKIE_SECURE: emptyAsUnset(booleanString),
  TRUST_PROXY: trustProxy,
  METRICS_TOKEN: emptyAsUnset(z.string().min(32)),
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
  WEBHOOK_MAX_BODY_BYTES: z.coerce.number().int().positive().default(262_144),
  WEBHOOK_INGEST_PER_SLUG_PER_MINUTE: z.coerce.number().int().positive().default(120),
  WEBHOOK_INGEST_PER_IP_PER_MINUTE: z.coerce.number().int().positive().default(600),
  WEBHOOK_EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  WEBHOOK_MAX_EVENTS_PER_ENDPOINT: z.coerce.number().int().positive().default(1_000),
  LIVE_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(25_000),
  LIVE_MAX_CONNECTIONS_PER_USER: z.coerce.number().int().positive().default(5),
});

type Env = z.infer<typeof envSchema>;

const productionRules = (values: Env, context: z.RefinementCtx) => {
  if (values.NODE_ENV !== "production") {
    return;
  }

  if (values.COOKIE_SECURE === false) {
    context.addIssue({
      code: "custom",
      path: ["COOKIE_SECURE"],
      message: "COOKIE_SECURE cannot be false in production",
    });
  }

  for (const key of ["JWT_SECRET", "INVITE_SECRET"] as const) {
    if (values[key].startsWith("replace-with")) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: `${key} still has the example placeholder value`,
      });
    }
  }
};

export const parseEnv = (source: Record<string, string | undefined>) =>
  envSchema.superRefine(productionRules).safeParse(source);

const result = parseEnv(process.env);

if (!result.success) {
  console.error(
    `Invalid environment variables:\n${z.prettifyError(result.error)}`,
  );
  process.exit(1);
}

export const env = result.data;

export const isProduction = env.NODE_ENV === "production";

export const isLocalEnvironment =
  env.NODE_ENV === "development" || env.NODE_ENV === "test";

export const useSecureCookies = env.COOKIE_SECURE ?? !isLocalEnvironment;

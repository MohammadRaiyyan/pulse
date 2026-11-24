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
  OWNER_SIGNUP_ENABLED: z.stringbool().default(false),
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
  MAIL_TRANSPORT: z.enum(["smtp", "file"]).default("smtp"),
  MAIL_FILE: z.string().default(""),
  MAIL_FROM: z.string().default(""),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
});

type Env = z.infer<typeof envSchema>;

const productionRules = (values: Env, context: z.RefinementCtx) => {
  const invalid = (variable: string, message: string) =>
    context.addIssue({ code: "custom", path: [variable], message });

  if (values.MAIL_TRANSPORT === "file" && !values.MAIL_FILE) {
    invalid("MAIL_FILE", "MAIL_FILE is required when MAIL_TRANSPORT is file");
  }

  if (values.NODE_ENV !== "production") {
    return;
  }

  if (values.COOKIE_SECURE === false) {
    invalid("COOKIE_SECURE", "COOKIE_SECURE cannot be false in production");
  }

  for (const key of ["JWT_SECRET", "INVITE_SECRET"] as const) {
    if (values[key].startsWith("replace-with")) {
      invalid(key, `${key} still has the example placeholder value`);
    }
  }

  if (values.MAIL_TRANSPORT !== "smtp") {
    invalid("MAIL_TRANSPORT", "Production must send email over SMTP");
  }

  if (!values.SMTP_HOST) {
    invalid("SMTP_HOST", "SMTP_HOST is required in production");
  }

  if (!values.MAIL_FROM) {
    invalid("MAIL_FROM", "MAIL_FROM is required in production");
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

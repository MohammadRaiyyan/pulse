import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./src/test/setup.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
      APP_URL: "http://localhost:5173",
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://pulse:pulse@localhost:5432/pulse_test",
      REDIS_URL: process.env.TEST_REDIS_URL ?? "redis://localhost:6379/1",
      JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters",
      INVITE_SECRET: "test-invite-secret-that-is-at-least-32-characters",
      LIVE_HEARTBEAT_INTERVAL_MS: "200",
      MAIL_TRANSPORT: "file",
      MAIL_FILE: join(tmpdir(), `pulse-api-test-mail-${process.pid}.jsonl`),
      OWNER_SIGNUP_ENABLED: "true",
      ALLOW_PRIVATE_NETWORK_TARGETS: "true",
    },
  },
});

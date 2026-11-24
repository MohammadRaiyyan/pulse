import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.ts";
import { parseTrustProxy } from "./trust-proxy.ts";

const baseEnv = {
  NODE_ENV: "production",
  APP_URL: "https://pulse.example.com",
  DATABASE_URL: "postgres://pulse:pulse@localhost:5432/pulse",
  REDIS_URL: "redis://localhost:6379/0",
  JWT_SECRET: "a-production-jwt-secret-that-is-long-enough",
  INVITE_SECRET: "a-production-invite-secret-that-is-long-enough",
  SMTP_HOST: "smtp.example.com",
  MAIL_FROM: "Pulse <alerts@pulse.example.com>",
};

const issuePaths = (source: Record<string, string | undefined>) => {
  const result = parseEnv(source);
  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
};

describe("environment validation", () => {
  it("accepts a complete production environment", () => {
    const result = parseEnv(baseEnv);

    expect(result.success).toBe(true);
    expect(result.data?.TRUST_PROXY).toEqual(["loopback"]);
    expect(result.data?.METRICS_TOKEN).toBeUndefined();
  });

  it("treats an empty migration URL as unset and validates a given one", () => {
    expect(
      parseEnv({ ...baseEnv, DATABASE_MIGRATION_URL: "" }).data
        ?.DATABASE_MIGRATION_URL,
    ).toBeUndefined();
    expect(
      issuePaths({ ...baseEnv, DATABASE_MIGRATION_URL: "not a url" }),
    ).toContain("DATABASE_MIGRATION_URL");
  });

  it("requires NODE_ENV", () => {
    expect(issuePaths({ ...baseEnv, NODE_ENV: undefined })).toContain(
      "NODE_ENV",
    );
  });

  it("rejects unknown NODE_ENV values", () => {
    expect(issuePaths({ ...baseEnv, NODE_ENV: "staging" })).toContain(
      "NODE_ENV",
    );
  });

  it("enforces secret length", () => {
    expect(issuePaths({ ...baseEnv, JWT_SECRET: "short" })).toContain(
      "JWT_SECRET",
    );
  });

  it("requires SMTP delivery settings in production", () => {
    const withoutMail = { ...baseEnv, SMTP_HOST: undefined, MAIL_FROM: undefined };

    expect(issuePaths(withoutMail)).toEqual(expect.arrayContaining(["SMTP_HOST", "MAIL_FROM"]));
    expect(issuePaths({ ...baseEnv, MAIL_TRANSPORT: "file", MAIL_FILE: "/tmp/mail.jsonl" })).toContain(
      "MAIL_TRANSPORT",
    );
  });

  it("rejects example placeholder secrets in production", () => {
    const placeholder = "replace-with-output-of-openssl-rand-base64-48";

    expect(issuePaths({ ...baseEnv, INVITE_SECRET: placeholder })).toContain(
      "INVITE_SECRET",
    );
    expect(
      parseEnv({
        ...baseEnv,
        NODE_ENV: "development",
        INVITE_SECRET: placeholder,
      }).success,
    ).toBe(true);
  });

  it("refuses insecure cookies in production only", () => {
    expect(issuePaths({ ...baseEnv, COOKIE_SECURE: "false" })).toContain(
      "COOKIE_SECURE",
    );
    expect(
      parseEnv({ ...baseEnv, NODE_ENV: "development", COOKIE_SECURE: "true" })
        .data?.COOKIE_SECURE,
    ).toBe(true);
  });

  it("treats empty optional values as unset", () => {
    const result = parseEnv({
      ...baseEnv,
      COOKIE_SECURE: "",
      METRICS_TOKEN: "",
    });

    expect(result.success).toBe(true);
    expect(result.data?.COOKIE_SECURE).toBeUndefined();
    expect(result.data?.METRICS_TOKEN).toBeUndefined();
  });

  it("requires a long metrics token when set", () => {
    expect(issuePaths({ ...baseEnv, METRICS_TOKEN: "short" })).toContain(
      "METRICS_TOKEN",
    );
  });

  it("rejects an invalid TRUST_PROXY", () => {
    expect(issuePaths({ ...baseEnv, TRUST_PROXY: "true" })).toContain(
      "TRUST_PROXY",
    );
  });
});

describe("TRUST_PROXY parsing", () => {
  it("disables proxy trust with false", () => {
    expect(parseTrustProxy("false")).toBe(false);
  });

  it("accepts a hop count", () => {
    expect(parseTrustProxy("2")).toBe(2);
    expect(parseTrustProxy("0")).toBe(0);
  });

  it("accepts presets, addresses and CIDR ranges", () => {
    expect(
      parseTrustProxy("loopback, 10.0.0.0/8, 192.168.1.10, fd00::/8"),
    ).toEqual(["loopback", "10.0.0.0/8", "192.168.1.10", "fd00::/8"]);
  });

  it("rejects trusting every proxy and malformed entries", () => {
    for (const value of [
      "true",
      "",
      "10.0.0.0/33",
      "not-an-ip",
      "1.2.3.4/8/1",
    ]) {
      expect(parseTrustProxy(value)).toBeInstanceOf(Error);
    }
  });
});

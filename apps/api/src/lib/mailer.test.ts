import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { readSentEmails } from "../test/mail.ts";
import {
  alertEmail,
  invitationEmail,
  passwordResetEmail,
} from "./email-templates.ts";
import { sendEmail } from "./mailer.ts";

const apiDirectory = new URL("../..", import.meta.url).pathname;

const baseEnvironment = {
  PATH: process.env.PATH,
  APP_URL: "http://localhost:5173",
  DATABASE_URL: "postgres://pulse:pulse@localhost:5432/unused",
  REDIS_URL: "redis://localhost:6379/9",
  JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters",
  INVITE_SECRET: "test-invite-secret-that-is-at-least-32-characters",
  LOG_LEVEL: "info",
};

const runScript = (script: string, environment: Record<string, string>) =>
  spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: apiDirectory,
    env: { ...baseEnvironment, ...environment },
    encoding: "utf8",
  });

describe("mailer", () => {
  it("delivers messages through the configured transport", async () => {
    await sendEmail({
      to: "sam@test.dev",
      subject: "Hello",
      text: "Plain body",
      html: "<p>Html body</p>",
    });

    const [email] = await readSentEmails();
    expect(email).toMatchObject({
      to: "sam@test.dev",
      subject: "Hello",
      text: "Plain body",
      html: "<p>Html body</p>",
      from: "Pulse <no-reply@localhost>",
    });
    expect(email?.messageId).toMatch(/^<.+>$/);
  });

  it("stops a production start without SMTP settings", () => {
    const result = runScript("await import('./src/config/env.ts')", {
      NODE_ENV: "production",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("SMTP_HOST");
    expect(result.stderr).toContain("MAIL_FROM");
  });

  it("accepts a production start with SMTP settings", () => {
    const result = runScript("await import('./src/config/env.ts')", {
      NODE_ENV: "production",
      SMTP_HOST: "smtp.example.com",
      MAIL_FROM: "Pulse <alerts@example.com>",
      ENCRYPTION_KEY: "7fnlwIBVNDyDcc/RxBcBzyzeQE2c+mfo2PT/6XjuejY=",
    });

    expect(result.status).toBe(0);
  });

  it("logs disabled delivery in development without the message body", () => {
    const result = runScript(
      `const { sendEmail } = await import('./src/lib/mailer.ts');
       await sendEmail({ to: 'sam@test.dev', subject: 'Reset', text: 'https://secret-link/token' });`,
      { NODE_ENV: "development" },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Email not sent because delivery is disabled");
    expect(result.stdout).not.toContain("secret-link");
  });
});

describe("email templates", () => {
  it("puts the action link in both text and html and escapes html", () => {
    const reset = passwordResetEmail({
      resetUrl: "https://app.test/reset-password?token=abc&x=1",
      expiresInMinutes: 30,
    });
    expect(reset.text).toContain(
      "https://app.test/reset-password?token=abc&x=1",
    );
    expect(reset.html).toContain(
      'href="https://app.test/reset-password?token=abc&amp;x=1"',
    );

    const invite = invitationEmail({
      inviteUrl: "https://app.test/invite/abc",
      inviterName: "<Ada>",
      role: "admin",
      expiresInDays: 7,
    });
    expect(invite.subject).toBe("<Ada> invited you to Pulse");
    expect(invite.html).toContain("&lt;Ada&gt;");
    expect(invite.html).not.toContain("<Ada>");

    const alert = alertEmail({ subject: "Down", message: "API is down" });
    expect(alert.text).toContain("API is down");
    expect(alert.html).not.toContain("Open Pulse");
  });
});

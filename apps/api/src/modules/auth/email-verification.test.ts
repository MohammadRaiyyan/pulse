import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "../../lib/mailer.ts";
import {
  registerUser,
  request,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";

vi.mock("../../lib/mailer.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/mailer.ts")>()),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

useTestServer();

const sentEmail = vi.mocked(sendEmail);

const latestTokenSentTo = (email: string) => {
  const message = sentEmail.mock.calls
    .map(([sent]) => sent)
    .filter((sent) => sent.to === email)
    .at(-1);

  return message?.text.match(/verify-email\?token=([\w-]+)/)?.[1] ?? "";
};

const verify = (token: string) =>
  request("/api/auth/email/verify", { method: "POST", body: { token } });

const refreshUser = async (cookie: string | undefined) =>
  (await request("/api/auth/refresh", { method: "POST", cookie })).body.user;

const changeEmail = (token: string, email: string, currentPassword?: string) =>
  request("/api/me", {
    method: "PATCH",
    token,
    body: { name: "Owner", email, currentPassword },
  });

describe("email verification", () => {
  beforeEach(() => {
    sentEmail.mockClear();
  });

  it("sends a link on sign-up that verifies the email exactly once", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");

    expect(owner.user.emailVerifiedAt).toBeNull();
    expect(sentEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@test.dev",
        subject: "Verify your email for Pulse",
      }),
    );

    const token = latestTokenSentTo("owner@test.dev");
    expect((await verify(token)).status).toBe(204);
    expect((await refreshUser(owner.cookie)).emailVerifiedAt).toEqual(
      expect.any(String),
    );

    const reused = await verify(token);
    expect(reused.status).toBe(404);
    expect(reused.body.error.message).toBe(
      "This verification link is invalid or has expired",
    );
  });

  it("rejects unknown tokens", async () => {
    expect((await verify("made-up-token")).status).toBe(404);
  });

  it("resends a link to unverified users only and rate limits resends", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const resend = () =>
      request("/api/me/email/verification", {
        method: "POST",
        token: owner.token,
      });

    expect((await resend()).status).toBe(204);
    expect((await resend()).status).toBe(204);
    expect((await resend()).status).toBe(204);
    expect((await resend()).status).toBe(429);
  });

  it("refuses to resend a link to a verified user", async () => {
    const member = await signInWithRole("member", "member@test.dev");

    const response = await request("/api/me/email/verification", {
      method: "POST",
      token: member.token,
    });
    expect(response.status).toBe(409);
  });

  it("requires the current password to change the email and marks it unverified", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    await verify(latestTokenSentTo("owner@test.dev"));

    const missing = await changeEmail(owner.token, "new@test.dev");
    expect(missing.status).toBe(400);
    expect(missing.body.error.fieldErrors.currentPassword).toEqual([
      "Enter your current password to change your email",
    ]);

    const wrong = await changeEmail(owner.token, "new@test.dev", "nope-nope");
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fieldErrors.currentPassword).toEqual([
      "Current password is incorrect",
    ]);

    const nameOnly = await request("/api/me", {
      method: "PATCH",
      token: owner.token,
      body: { name: "Renamed", email: "owner@test.dev" },
    });
    expect(nameOnly.status).toBe(200);
    expect(nameOnly.body.emailVerifiedAt).toEqual(expect.any(String));

    const changed = await changeEmail(owner.token, "new@test.dev", "password123");
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      email: "new@test.dev",
      emailVerifiedAt: null,
    });

    expect((await verify(latestTokenSentTo("new@test.dev"))).status).toBe(204);
    expect((await refreshUser(owner.cookie)).emailVerifiedAt).toEqual(
      expect.any(String),
    );
  });

  it("does not let a link for a previous email verify the current one", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const oldToken = latestTokenSentTo("owner@test.dev");

    await changeEmail(owner.token, "new@test.dev", "password123");

    expect((await verify(oldToken)).status).toBe(404);
    expect((await refreshUser(owner.cookie)).emailVerifiedAt).toBeNull();
  });

  it("marks invited users as verified when they accept", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const invitation = await request("/api/invitations", {
      method: "POST",
      token: owner.token,
      body: { email: "sam@test.dev", role: "member" },
    });

    const accepted = await request("/api/invitations/accept", {
      method: "POST",
      body: {
        token: invitation.body.inviteUrl.split("/invite/")[1],
        name: "Sam",
        password: "password123",
      },
    });

    expect(accepted.status).toBe(201);
    expect(accepted.body.user.emailVerifiedAt).toEqual(expect.any(String));
  });
});

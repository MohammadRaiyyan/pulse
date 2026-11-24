import { describe, expect, it } from "vitest";
import { minutesFromNow } from "../../lib/dates.ts";
import { generateToken, hashToken } from "../../security/tokens.ts";
import { registerUser, request, useTestServer } from "../../test/client.ts";
import {
  clearSentEmails,
  readSentEmails,
  waitForEmail,
} from "../../test/mail.ts";
import { insertPasswordResetToken } from "../auth/password-reset.repository.ts";
import {
  listLinkedAccounts,
  saveLinkedAccount,
} from "../oauth/linked-account.repository.ts";

useTestServer();

const issueResetToken = async (userId: string) => {
  const token = generateToken();
  await insertPasswordResetToken(userId, hashToken(token), minutesFromNow(30));
  return token;
};

const linkProviders = async (userId: string) => {
  await saveLinkedAccount({
    userId,
    provider: "github",
    providerAccountId: "gh-1",
    email: "owner@test.dev",
  });
  await saveLinkedAccount({
    userId,
    provider: "google",
    providerAccountId: "google-1",
    email: "owner@test.dev",
  });
};

describe("account security notifications", () => {
  it("unlinks every provider when a password reset completes", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    await linkProviders(owner.user.id);
    const token = await issueResetToken(owner.user.id);
    await clearSentEmails();

    const reset = await request("/api/auth/password/reset", {
      method: "POST",
      body: { token, password: "password456" },
    });
    expect(reset.status).toBe(204);

    expect(await listLinkedAccounts(owner.user.id)).toEqual([]);

    const email = await waitForEmail("owner@test.dev");
    expect(email.subject).toBe("Your Pulse password was changed");
    expect(email.text).toContain("disconnected GitHub and Google sign-in");
    expect(email.text).toContain("Reconnect it in Settings");
    expect(email.text).not.toMatch(/https?:\/\//);
  });

  it("keeps providers linked when the reset token is invalid", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    await linkProviders(owner.user.id);

    const reset = await request("/api/auth/password/reset", {
      method: "POST",
      body: { token: "made-up-token", password: "password456" },
    });
    expect(reset.status).toBe(404);
    expect(await listLinkedAccounts(owner.user.id)).toHaveLength(2);
  });

  it("emails a notice after a password change", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    await clearSentEmails();

    const changed = await request("/api/me/password", {
      method: "POST",
      token: owner.token,
      body: { currentPassword: "password123", newPassword: "password456" },
    });
    expect(changed.status).toBe(204);

    const email = await waitForEmail("owner@test.dev");
    expect(email.subject).toBe("Your Pulse password was changed");
    expect(email.text).toContain("If this was not you");
    expect(email.text).not.toContain("disconnected");
    expect(email.text).not.toMatch(/https?:\/\//);
  });

  it("does not email anyone when a password change is rejected", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    await clearSentEmails();

    const changed = await request("/api/me/password", {
      method: "POST",
      token: owner.token,
      body: { currentPassword: "wrong-password", newPassword: "password456" },
    });
    expect(changed.status).toBe(400);
    expect(await readSentEmails()).toEqual([]);
  });

  it("tells the old address when the email changes", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    await clearSentEmails();

    const updated = await request("/api/me", {
      method: "PATCH",
      token: owner.token,
      body: {
        name: "Owner",
        email: "new-owner@test.dev",
        currentPassword: "password123",
      },
    });
    expect(updated.status).toBe(200);

    const notice = await waitForEmail("owner@test.dev");
    expect(notice.subject).toBe("Your email address was changed");
    expect(notice.text).toContain("new-owner@test.dev");
    expect(notice.text).toContain("contact your workspace admin");
    expect(notice.text).not.toMatch(/https?:\/\//);

    const verification = await waitForEmail("new-owner@test.dev");
    expect(verification.subject).toBe("Verify your email for Pulse");
  });

  it("sends no change notice when only the name changes", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    await clearSentEmails();

    const updated = await request("/api/me", {
      method: "PATCH",
      token: owner.token,
      body: { name: "Renamed", email: "owner@test.dev" },
    });
    expect(updated.status).toBe(200);
    expect(await readSentEmails()).toEqual([]);
  });
});

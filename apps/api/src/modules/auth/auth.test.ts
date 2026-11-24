import { describe, expect, it } from "vitest";
import { registerUser, request, useTestServer } from "../../test/client.ts";
import { readSentEmails, waitForEmail } from "../../test/mail.ts";

useTestServer();

const attemptLogin = () =>
  request("/api/auth/login", {
    method: "POST",
    body: { email: "victim@test.dev", password: "wrong-pass" },
  });

describe("auth", () => {
  it("makes the first user the owner and later users viewers", async () => {
    const first = await registerUser("First", "first@test.dev");
    const second = await registerUser("Second", "second@test.dev");

    expect(first.user.role).toBe("owner");
    expect(second.user.role).toBe("viewer");
    expect(first.cookie).toMatch(/^pulse_refresh=/);
  });

  it("rejects a duplicate email with a field error", async () => {
    await registerUser("First", "taken@test.dev");
    const response = await request("/api/auth/register", {
      method: "POST",
      body: { name: "Again", email: "TAKEN@test.dev", password: "password123" },
    });

    expect(response.status).toBe(409);
    expect(response.body.error.fieldErrors.email).toEqual([
      "An account with this email already exists",
    ]);
  });

  it("returns the same 401 for unknown email and wrong password", async () => {
    await registerUser("Owner", "owner@test.dev");

    const wrongPassword = await request("/api/auth/login", {
      method: "POST",
      body: { email: "owner@test.dev", password: "nope-nope" },
    });
    const unknownEmail = await request("/api/auth/login", {
      method: "POST",
      body: { email: "ghost@test.dev", password: "nope-nope" },
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(
      unknownEmail.body.error.message,
    );
  });

  it("rotates the refresh token and rejects it after logout", async () => {
    const { cookie } = await registerUser("Owner", "owner@test.dev");

    const refreshed = await request("/api/auth/refresh", {
      method: "POST",
      cookie,
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTypeOf("string");
    expect(refreshed.refreshCookie).toBeDefined();
    expect(refreshed.refreshCookie).not.toBe(cookie);

    const logout = await request("/api/auth/logout", {
      method: "POST",
      cookie: refreshed.refreshCookie,
    });
    expect(logout.status).toBe(204);

    const afterLogout = await request("/api/auth/refresh", {
      method: "POST",
      cookie: refreshed.refreshCookie,
    });
    expect(afterLogout.status).toBe(401);
  });

  it("revokes the whole session family when an old refresh token is reused", async () => {
    const { cookie } = await registerUser("Owner", "owner@test.dev");

    const rotated = await request("/api/auth/refresh", {
      method: "POST",
      cookie,
    });
    const replay = await request("/api/auth/refresh", {
      method: "POST",
      cookie,
    });
    const afterReplay = await request("/api/auth/refresh", {
      method: "POST",
      cookie: rotated.refreshCookie,
    });

    expect(rotated.status).toBe(200);
    expect(replay.status).toBe(401);
    expect(afterReplay.status).toBe(401);
  });

  it("rejects a profile email that belongs to someone else", async () => {
    await registerUser("Owner", "owner@test.dev");
    const second = await registerUser("Second", "second@test.dev");

    const response = await request("/api/me", {
      method: "PATCH",
      token: second.token,
      body: { name: "Second", email: "owner@test.dev" },
    });

    expect(response.status).toBe(409);
    expect(response.body.error.fieldErrors.email).toEqual([
      "An account with this email already exists",
    ]);
  });

  it("ends existing access tokens immediately on sign out everywhere", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");

    expect((await request("/api/monitors", { token })).status).toBe(200);

    const signOut = await request("/api/auth/logout-all", { method: "POST", token });
    expect(signOut.status).toBe(204);

    expect((await request("/api/monitors", { token })).status).toBe(401);
  });

  it("keeps the current device signed in after a password change but ends old tokens", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");

    const changed = await request("/api/me/password", {
      method: "POST",
      token,
      body: { currentPassword: "password123", newPassword: "password456" },
    });
    expect(changed.status).toBe(204);
    expect(changed.refreshCookie).toBeDefined();

    expect((await request("/api/monitors", { token })).status).toBe(401);

    const refreshed = await request("/api/auth/refresh", { method: "POST", cookie: changed.refreshCookie });
    expect(refreshed.status).toBe(200);
    expect((await request("/api/monitors", { token: refreshed.body.accessToken })).status).toBe(200);

    const oldPassword = await request("/api/auth/login", {
      method: "POST",
      body: { email: "owner@test.dev", password: "password123" },
    });
    expect(oldPassword.status).toBe(401);
  });

  it("rate limits repeated logins with a Retry-After header", async () => {
    for (let index = 0; index < 5; index += 1) {
      expect((await attemptLogin()).status).toBe(401);
    }

    const blocked = await attemptLogin();
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("resets a password with a valid token only", async () => {
    const response = await request("/api/auth/password/reset", {
      method: "POST",
      body: { token: "made-up-token", password: "password456" },
    });

    expect(response.status).toBe(404);
  });

  it("emails a working reset link and sends nothing for unknown addresses", async () => {
    await registerUser("Owner", "owner@test.dev");

    const unknown = await request("/api/auth/password/forgot", {
      method: "POST",
      body: { email: "nobody@test.dev" },
    });
    expect(unknown.status).toBe(204);

    const forgot = await request("/api/auth/password/forgot", {
      method: "POST",
      body: { email: "owner@test.dev" },
    });
    expect(forgot.status).toBe(204);

    const email = await waitForEmail("owner@test.dev");
    expect(email.subject).toBe("Reset your Pulse password");
    expect(await readSentEmails()).toHaveLength(1);

    const resetUrl = new URL(
      email.text.match(/http\S+reset-password\S+/)?.[0] ?? "",
    );
    expect(email.html).toContain("Reset password");
    expect(resetUrl.origin).toBe("http://localhost:5173");

    const reset = await request("/api/auth/password/reset", {
      method: "POST",
      body: {
        token: resetUrl.searchParams.get("token"),
        password: "password456",
      },
    });
    expect(reset.status).toBe(204);

    const login = await request("/api/auth/login", {
      method: "POST",
      body: { email: "owner@test.dev", password: "password456" },
    });
    expect(login.status).toBe(200);
  });
});

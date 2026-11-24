import { describe, expect, it } from "vitest";
import { registerUser, request, useTestServer } from "../../test/client.ts";

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
});

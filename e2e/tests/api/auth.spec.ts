import { expect, test } from "../../support/fixtures.ts";
import { DEMO_PASSWORD, createTeammate, demoUsers, uniqueEmail } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";

const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
  fetch(`${API_ORIGIN}/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const refreshCookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith("pulse_refresh="))
    ?.split(";")[0];

const getWithToken = (path: string, token: string) =>
  fetch(`${API_ORIGIN}/api${path}`, { headers: { Authorization: `Bearer ${token}` } });

test.describe("authentication", () => {
  test("login returns an access token and an httpOnly refresh cookie scoped to /api/auth", async () => {
    const response = await post("/auth/login", { email: demoUsers.viewer, password: DEMO_PASSWORD });
    const body = await response.json();
    const cookie = response.headers.getSetCookie().find((value) => value.startsWith("pulse_refresh="));

    expect(response.status).toBe(200);
    expect(body.user).toMatchObject({ email: demoUsers.viewer, role: "viewer" });
    expect(body.user.passwordHash).toBeUndefined();
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/api/auth");
    expect(cookie).toContain("SameSite=Lax");
  });

  test("unknown email and wrong password are indistinguishable", async () => {
    const wrongPassword = await post("/auth/login", { email: demoUsers.viewer, password: "wrong-password" });
    const unknownEmail = await post("/auth/login", { email: uniqueEmail("ghost"), password: "wrong-password" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(await wrongPassword.json()).toEqual(await unknownEmail.json());
  });

  test("refresh rotates the token and a replayed token revokes the whole family", async ({ ownerApi: owner }) => {
    const teammate = await createTeammate(owner, "viewer");

    const login = await post("/auth/login", { email: teammate.email, password: DEMO_PASSWORD });
    const firstCookie = refreshCookieOf(login);

    const rotated = await post("/auth/refresh", undefined, { Cookie: firstCookie ?? "" });
    const secondCookie = refreshCookieOf(rotated);
    expect(rotated.status).toBe(200);
    expect(secondCookie).not.toBe(firstCookie);

    const replay = await post("/auth/refresh", undefined, { Cookie: firstCookie ?? "" });
    expect(replay.status).toBe(401);

    const afterReplay = await post("/auth/refresh", undefined, { Cookie: secondCookie ?? "" });
    expect(afterReplay.status).toBe(401);

  });

  test("sign out everywhere rejects existing access tokens immediately", async ({ ownerApi: owner }) => {
    const teammate = await createTeammate(owner, "member");
    const token = teammate.client.token;

    expect((await getWithToken("/monitors", token)).status).toBe(200);

    const signOut = await fetch(`${API_ORIGIN}/api/auth/logout-all`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(signOut.status).toBe(204);
    expect((await getWithToken("/monitors", token)).status).toBe(401);

  });

  test("failed logins are rate limited with Retry-After", async () => {
    const email = uniqueEmail("brute-force");
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await post("/auth/login", { email, password: `guess-${attempt}` })).status);
    }

    const blocked = await post("/auth/login", { email, password: "guess-final" });

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await blocked.json()).error.code).toBe("RATE_LIMITED");
  });

  test("password reset always answers 204 and rejects unknown tokens", async () => {
    expect((await post("/auth/password/forgot", { email: uniqueEmail("nobody") })).status).toBe(204);

    const reset = await post("/auth/password/reset", { token: "not-a-real-token", password: "password999" });
    expect(reset.status).toBe(404);
  });
});

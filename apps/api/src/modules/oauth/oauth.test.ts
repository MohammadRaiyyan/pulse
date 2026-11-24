import { count } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../db/client.ts";
import { users } from "../../models/index.ts";
import {
  readCookie,
  registerUser,
  request,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";
import { fetchProfile } from "./oauth-providers.ts";

vi.mock("./oauth-providers.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./oauth-providers.ts")>()),
  isProviderConfigured: () => true,
  fetchProfile: vi.fn(),
}));

useTestServer();

const profileFor = (email: string) => ({
  providerAccountId: `github-${email}`,
  email,
  name: "Git Hubber",
});

const startOAuth = async (token?: string) => {
  const response = await request("/api/auth/oauth/github/authorize", {
    method: "POST",
    token,
    body: { intent: token ? "link" : "sign-in" },
  });
  const state = new URL(response.body.authorizationUrl).searchParams.get(
    "state",
  );

  return {
    state: state ?? "",
    nonceCookie: readCookie(response.headers, "pulse_oauth_nonce"),
    setCookie: response.headers.getSetCookie().join("\n"),
  };
};

const authorizeWith = (redirectTo: string) =>
  request("/api/auth/oauth/github/authorize", {
    method: "POST",
    body: { intent: "sign-in", redirectTo },
  });

const finishOAuth = (state: string, cookie: string | undefined) =>
  request("/api/auth/oauth/github/callback", {
    method: "POST",
    cookie,
    body: { code: "provider-code", state },
  });

const signInWithGithub = async (email: string) => {
  vi.mocked(fetchProfile).mockResolvedValue(profileFor(email));
  const { state, nonceCookie } = await startOAuth();
  return finishOAuth(state, nonceCookie);
};

const countUsers = async () => {
  const [row] = await db.select({ total: count() }).from(users);
  return row?.total ?? 0;
};

describe("oauth", () => {
  beforeEach(() => {
    vi.mocked(fetchProfile).mockReset();
  });

  it("sets an httpOnly nonce cookie scoped to the callback", async () => {
    const { nonceCookie, setCookie } = await startOAuth();

    expect(nonceCookie).toMatch(/^pulse_oauth_nonce=.+/);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/api/auth/oauth/github/callback");
  });

  it("accepts only same-site paths as the redirect target", async () => {
    expect((await authorizeWith("/monitors?page=2")).status).toBe(200);
    expect((await authorizeWith("//evil.example")).status).toBe(400);
    expect((await authorizeWith("/\\evil.example")).status).toBe(400);
    expect((await authorizeWith("https://evil.example")).status).toBe(400);
  });

  it("rejects a callback without the browser's nonce cookie", async () => {
    await signInWithRole("member", "member@test.dev");
    vi.mocked(fetchProfile).mockResolvedValue(profileFor("member@test.dev"));

    const missing = await startOAuth();
    const withoutCookie = await finishOAuth(missing.state, undefined);

    const mismatched = await startOAuth();
    const other = await startOAuth();
    const withOtherCookie = await finishOAuth(
      mismatched.state,
      other.nonceCookie,
    );

    expect(withoutCookie.status).toBe(401);
    expect(withOtherCookie.status).toBe(401);
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it("links to an existing account by email only when that email is verified", async () => {
    const member = await signInWithRole("member", "member@test.dev");

    const response = await signInWithGithub("member@test.dev");

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(member.user.id);

    const again = await signInWithGithub("member@test.dev");
    expect(again.body.user.id).toBe(member.user.id);
  });

  it("refuses to link to an account whose email is not verified", async () => {
    await registerUser("Owner", "owner@test.dev");

    const response = await signInWithGithub("owner@test.dev");

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/not verified its email/);
  });

  it("does not create accounts once the workspace has users", async () => {
    await signInWithRole("member", "member@test.dev");

    const response = await signInWithGithub("stranger@test.dev");

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/invite-only/);
    expect(await countUsers()).toBe(1);
  });

  it("creates a verified owner when the workspace is empty", async () => {
    const response = await signInWithGithub("founder@test.dev");

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      email: "founder@test.dev",
      role: "owner",
      emailVerifiedAt: expect.any(String),
    });
  });
});

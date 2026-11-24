import { describe, expect, it } from "vitest";
import {
  registerUser,
  request,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";

useTestServer();

describe("members", () => {
  it("protects the owner and the acting user", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const admin = await signInWithRole("admin", "admin@test.dev");

    const changeOwner = await request(`/api/members/${owner.user.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { role: "viewer" },
    });
    expect(changeOwner.status).toBe(403);

    const changeSelf = await request(`/api/members/${admin.user.id}`, {
      method: "PATCH",
      token: admin.token,
      body: { role: "viewer" },
    });
    expect(changeSelf.status).toBe(403);

    const promoteToOwner = await request(`/api/members/${admin.user.id}`, {
      method: "PATCH",
      token: owner.token,
      body: { role: "owner" },
    });
    expect(promoteToOwner.status).toBe(400);
  });

  it("applies a role change immediately", async () => {
    const owner = await registerUser("Owner", "owner@test.dev");
    const member = await signInWithRole("member", "member@test.dev");

    const before = await request("/api/monitors", {
      method: "POST",
      token: member.token,
      body: {
        name: "A",
        url: "https://example.com",
        method: "GET",
        intervalSeconds: 60,
        timeoutMs: 5000,
        expectedStatusCode: 200,
        alertChannelIds: [],
      },
    });
    expect(before.status).toBe(201);

    await request(`/api/members/${member.user.id}`, {
      method: "PATCH",
      token: owner.token,
      body: { role: "viewer" },
    });

    const after = await request(`/api/monitors/${before.body.id}`, {
      method: "DELETE",
      token: member.token,
    });
    expect(after.status).toBe(403);
  });
});

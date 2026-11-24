import { describe, expect, it } from "vitest";
import {
  registerUser,
  request,
  signInWithRole,
  useTestServer,
} from "../test/client.ts";

useTestServer();

const newMonitor = {
  name: "API",
  url: "https://example.com",
  method: "GET",
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatusCode: 200,
  alertChannelIds: [],
};

describe("authentication and permissions", () => {
  it("returns 401 without a token", async () => {
    const response = await request("/api/monitors");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 for a forged token", async () => {
    const response = await request("/api/monitors", { token: "not.a.jwt" });
    expect(response.status).toBe(401);
  });

  it("lets a viewer read but not write", async () => {
    await registerUser("Owner", "owner@test.dev");
    const viewer = await signInWithRole("viewer", "viewer@test.dev");

    const read = await request("/api/monitors", { token: viewer.token });
    const write = await request("/api/monitors", {
      method: "POST",
      token: viewer.token,
      body: newMonitor,
    });

    expect(read.status).toBe(200);
    expect(write.status).toBe(403);
    expect(write.body.error.code).toBe("FORBIDDEN");
  });

  it("lets a member write monitors but not alert channels", async () => {
    await registerUser("Owner", "owner@test.dev");
    const member = await signInWithRole("member", "member@test.dev");

    const monitor = await request("/api/monitors", {
      method: "POST",
      token: member.token,
      body: newMonitor,
    });
    const channel = await request("/api/alert-channels", {
      method: "POST",
      token: member.token,
      body: {
        name: "Mail",
        isEnabled: true,
        destination: { type: "email", target: "a@test.dev" },
      },
    });

    expect(monitor.status).toBe(201);
    expect(channel.status).toBe(403);
  });
});

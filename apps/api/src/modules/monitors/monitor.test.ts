import { describe, expect, it } from "vitest";
import { registerUser, request, useTestServer } from "../../test/client.ts";

useTestServer();

const monitorInput = {
  name: "Public API",
  url: "https://example.com/health",
  method: "GET",
  intervalSeconds: 60,
  timeoutMs: 5000,
  expectedStatusCode: 200,
  alertChannelIds: [] as string[],
};

describe("monitors", () => {
  it("rejects invalid input with field errors", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const response = await request("/api/monitors", {
      method: "POST",
      token,
      body: { ...monitorInput, name: "", url: "not-a-url" },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(response.body.error.fieldErrors)).toEqual(
      expect.arrayContaining(["name", "url"]),
    );
  });

  it("rejects unknown alert channels", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const response = await request("/api/monitors", {
      method: "POST",
      token,
      body: {
        ...monitorInput,
        alertChannelIds: ["00000000-0000-4000-8000-000000000001"],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.fieldErrors.alertChannelIds).toEqual([
      "Unknown alert channel",
    ]);
  });

  it("creates, lists, filters, updates and deletes a monitor", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channel = await request("/api/alert-channels", {
      method: "POST",
      token,
      body: {
        name: "Mail",
        isEnabled: true,
        destination: { type: "email", target: "ops@test.dev" },
      },
    });

    const created = await request("/api/monitors", {
      method: "POST",
      token,
      body: { ...monitorInput, alertChannelIds: [channel.body.id] },
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("pending");
    expect(created.body.alertChannelIds).toEqual([channel.body.id]);

    const list = await request("/api/monitors?search=public&status=pending", {
      token,
    });
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].id).toBe(created.body.id);

    const updated = await request(`/api/monitors/${created.body.id}`, {
      method: "PATCH",
      token,
      body: { isPaused: true, alertChannelIds: [] },
    });
    expect(updated.body.isPaused).toBe(true);
    expect(updated.body.alertChannelIds).toEqual([]);

    const removed = await request(`/api/monitors/${created.body.id}`, {
      method: "DELETE",
      token,
    });
    expect(removed.status).toBe(204);

    const missing = await request(`/api/monitors/${created.body.id}`, {
      token,
    });
    expect(missing.status).toBe(404);
  });

  it("returns 404 for a malformed id instead of a database error", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const response = await request("/api/monitors/not-a-uuid", { token });

    expect(response.status).toBe(404);
  });
});

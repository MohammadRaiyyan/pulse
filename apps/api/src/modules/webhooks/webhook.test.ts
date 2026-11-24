import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db/client.ts";
import { webhooks } from "../../models/index.ts";
import { detectSilentWebhooks } from "./webhook.service.ts";
import {
  registerUser,
  request,
  sendRaw,
  useTestServer,
} from "../../test/client.ts";

useTestServer();

describe("webhooks", () => {
  it("records raw incoming events through the ingest URL", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const webhook = await request("/api/webhooks", {
      method: "POST",
      token,
      body: {
        name: "Stripe events",
        expectedIntervalSeconds: 3600,
        alertChannelIds: [],
      },
    });

    expect(webhook.status).toBe(201);
    expect(webhook.body.status).toBe("pending");
    expect(webhook.body.ingestUrl).toMatch(
      /^http:\/\/localhost:5173\/hooks\/stripe-events-[A-Za-z0-9_-]{22}$/,
    );

    const ingestPath = new URL(webhook.body.ingestUrl).pathname;
    const payload = '{"type":"invoice.paid",  "amount":1200}';
    const ingest = await sendRaw(ingestPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    expect(ingest.status).toBe(202);

    const updated = await request(`/api/webhooks/${webhook.body.id}`, {
      token,
    });
    expect(updated.body.status).toBe("active");
    expect(updated.body.eventCount).toBe(1);

    const events = await request(`/api/webhooks/${webhook.body.id}/events`, {
      token,
    });
    expect(events.body.items[0].body).toBe(payload);
    expect(events.body.items[0].contentType).toBe("application/json");
  });

  it("returns 404 for an unknown ingest slug", async () => {
    const response = await sendRaw("/hooks/does-not-exist", {
      method: "POST",
      body: "{}",
    });
    expect(response.status).toBe(404);
  });

  it("goes silent after its window and recovers when the window is removed", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const created = await request("/api/webhooks", {
      method: "POST",
      token,
      body: { name: "Nightly job", expectedIntervalSeconds: 3600, alertChannelIds: [] },
    });

    await db
      .update(webhooks)
      .set({ createdAt: new Date(Date.now() - 2 * 3600 * 1000) })
      .where(eq(webhooks.id, created.body.id));
    await detectSilentWebhooks();

    const silent = await request(`/api/webhooks/${created.body.id}`, { token });
    expect(silent.body.status).toBe("silent");

    const open = await request("/api/incidents?status=open", { token });
    expect(open.body.items[0]).toMatchObject({ cause: "No events received within 1h", source: { name: "Nightly job" } });

    const updated = await request(`/api/webhooks/${created.body.id}`, {
      method: "PATCH",
      token,
      body: { expectedIntervalSeconds: null },
    });
    expect(updated.body.status).toBe("pending");

    const stillOpen = await request("/api/incidents?status=open", { token });
    expect(stillOpen.body.total).toBe(0);
  });

  it("resolves the silence incident when an event finally arrives", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const created = await request("/api/webhooks", {
      method: "POST",
      token,
      body: { name: "Deploys", expectedIntervalSeconds: 60, alertChannelIds: [] },
    });

    await db
      .update(webhooks)
      .set({ createdAt: new Date(Date.now() - 120 * 1000) })
      .where(eq(webhooks.id, created.body.id));
    await detectSilentWebhooks();

    await sendRaw(new URL(created.body.ingestUrl).pathname, { method: "POST", body: "ping" });

    const recovered = await request(`/api/webhooks/${created.body.id}`, { token });
    expect(recovered.body.status).toBe("active");

    const resolved = await request("/api/incidents?status=resolved", { token });
    expect(resolved.body.total).toBe(1);
  });
});

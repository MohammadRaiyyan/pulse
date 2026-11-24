import { describe, expect, it } from "vitest";
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
      /^http:\/\/localhost:5173\/hooks\/stripe-events-[0-9a-f]{6}$/,
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
});

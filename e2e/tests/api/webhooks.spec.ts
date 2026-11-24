import { expect, test } from "../../support/fixtures.ts";
import { uniqueSuffix, waitFor } from "../../support/api-client.ts";
import { createAlertSink } from "../../support/alert-sink.ts";
import { API_ORIGIN, WEB_ORIGIN } from "../../support/environment.ts";

test.describe("webhooks", () => {
  test("ingest stores the raw request exactly as sent", async ({ ownerApi: owner }) => {

    const webhook = await owner.post("/webhooks", { name: "Stripe Events!", expectedIntervalSeconds: null, alertChannelIds: [] });
    expect(webhook.status).toBe(201);
    expect(webhook.body.ingestUrl).toMatch(new RegExp(`^${WEB_ORIGIN}/hooks/stripe-events-[0-9a-f]{6}$`));
    expect(webhook.body).toMatchObject({ status: "pending", eventCount: 0, lastReceivedAt: null });

    const payload = '{ "type": "invoice.paid",\n  "amount": 1200 }';
    const ingestPath = new URL(webhook.body.ingestUrl).pathname;
    const sent = await fetch(`${API_ORIGIN}${ingestPath}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Stripe-Signature": "t=1,v1=abc" },
      body: payload,
    });
    expect(sent.status).toBe(202);

    const viaFrontendProxy = await fetch(webhook.body.ingestUrl, { method: "POST", body: "plain text" });
    expect(viaFrontendProxy.status).toBe(202);

    const events = await owner.get(`/webhooks/${webhook.body.id}/events`);
    expect(events.body.total).toBe(2);
    const stripeEvent = events.body.items.find((event: { method: string }) => event.method === "PUT");
    expect(stripeEvent.body).toBe(payload);
    expect(stripeEvent.contentType).toBe("application/json");
    expect(stripeEvent.headers["stripe-signature"]).toBe("t=1,v1=abc");

    const updated = await owner.get(`/webhooks/${webhook.body.id}`);
    expect(updated.body).toMatchObject({ status: "active", eventCount: 2 });

    expect((await owner.delete(`/webhooks/${webhook.body.id}`)).status).toBe(204);
    expect((await fetch(`${API_ORIGIN}${ingestPath}`, { method: "POST", body: "{}" })).status).toBe(404);

  });

  test("silence detection opens an incident, alerts, and recovers on the next event", async ({ ownerApi: owner }) => {
    test.setTimeout(150_000);
    const sink = await createAlertSink(owner);

    const webhook = await owner.post("/webhooks", {
      name: `Nightly ${uniqueSuffix()}`,
      expectedIntervalSeconds: 60,
      alertChannelIds: [sink.channelId],
    });
    const webhookId = webhook.body.id;

    const silent = await waitFor(
      () => owner.get(`/webhooks/${webhookId}`),
      (response) => response.body.status === "silent",
      { timeout: 100_000, interval: 2_000 },
    );
    expect(silent.body.eventCount).toBe(0);

    const incidents = await owner.get("/incidents?status=open&pageSize=100");
    const incident = incidents.body.items.find((item: { source: { id: string } }) => item.source.id === webhookId);
    expect(incident).toMatchObject({ cause: "No events received within 1m", source: { type: "webhook" } });

    await waitFor(sink.receivedAlerts, (alerts) =>
      alerts.some((alert: { event: string; incident: { id: string } | null }) => alert.incident?.id === incident.id),
    );

    const ingestPath = new URL(webhook.body.ingestUrl).pathname;
    await fetch(`${API_ORIGIN}${ingestPath}`, { method: "POST", body: "{}" });

    const recovered = await owner.get(`/webhooks/${webhookId}`);
    expect(recovered.body.status).toBe("active");
    expect((await owner.get(`/incidents/${incident.id}`)).body.status).toBe("resolved");

  });

  test("removing the silence window clears a silent status", async ({ ownerApi: owner }) => {
    const webhooks = await owner.get("/webhooks?pageSize=100");
    const github = webhooks.body.items.find((item: { name: string }) => item.name === "GitHub deploys");

    if (github.status !== "silent") {
      test.skip(true, "seeded webhook already recovered by another test");
    }

    const updated = await owner.patch(`/webhooks/${github.id}`, { expectedIntervalSeconds: null });
    expect(updated.body.status).toBe("pending");

    const open = await owner.get("/incidents?status=open&pageSize=100");
    expect(open.body.items.some((item: { source: { id: string } }) => item.source.id === github.id)).toBe(false);

    await owner.patch(`/webhooks/${github.id}`, { expectedIntervalSeconds: 86_400 });
  });
});

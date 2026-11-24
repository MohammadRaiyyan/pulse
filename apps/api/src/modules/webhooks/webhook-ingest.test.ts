import { count, eq, min } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { env } from "../../config/env.ts";
import { db } from "../../db/client.ts";
import { daysAgo, minutesFromNow } from "../../lib/dates.ts";
import { webhookEvents, webhooks } from "../../models/index.ts";
import { cleanUpOldData } from "../maintenance/cleanup.service.ts";
import {
  registerUser,
  request,
  sendRaw,
  useTestServer,
} from "../../test/client.ts";
import { isSensitiveHeader, redactHeaders } from "./header-redaction.ts";
import { toSlug } from "./webhook.service.ts";

useTestServer();

const createWebhook = async (name: string, owner?: { token: string }) => {
  const { token } = owner ?? (await registerUser("Owner", "owner@test.dev"));
  const created = await request("/api/webhooks", {
    method: "POST",
    token,
    body: { name, expectedIntervalSeconds: null, alertChannelIds: [] },
  });

  return {
    token,
    id: created.body.id as string,
    ingestPath: new URL(created.body.ingestUrl).pathname,
  };
};

const insertEvents = (webhookId: string, receivedAts: Date[]) =>
  db.insert(webhookEvents).values(
    receivedAts.map((receivedAt) => ({
      webhookId,
      method: "POST",
      headers: {},
      body: "{}",
      contentType: null,
      sourceIp: "127.0.0.1",
      receivedAt,
    })),
  );

const storedEventCount = async (webhookId: string) => {
  const [row] = await db
    .select({ total: count() })
    .from(webhookEvents)
    .where(eq(webhookEvents.webhookId, webhookId));
  return row?.total ?? 0;
};

const oldestEvent = async (webhookId: string) => {
  const [row] = await db
    .select({ oldest: min(webhookEvents.receivedAt) })
    .from(webhookEvents)
    .where(eq(webhookEvents.webhookId, webhookId));
  return row?.oldest;
};

const minutesAgoList = (length: number, offset = 0) =>
  Array.from({ length }, (_, index) => minutesFromNow(-(index + offset + 1)));

describe("webhook header redaction", () => {
  it("redacts credentials and keeps signature headers", () => {
    expect(
      redactHeaders({
        authorization: "Bearer live-key",
        "proxy-authorization": "Basic abc",
        cookie: "session=1",
        "x-api-key": "key",
        "x-gitlab-token": "plain-secret",
        "x-client-secret": "secret",
        "x-db-password": "hunter2",
        "stripe-signature": "t=1,v1=abc",
        "x-hub-signature-256": "sha256=abc",
        "content-type": "application/json",
      }),
    ).toEqual({
      authorization: "[redacted]",
      "proxy-authorization": "[redacted]",
      cookie: "[redacted]",
      "x-api-key": "[redacted]",
      "x-gitlab-token": "[redacted]",
      "x-client-secret": "[redacted]",
      "x-db-password": "[redacted]",
      "stripe-signature": "t=1,v1=abc",
      "x-hub-signature-256": "sha256=abc",
      "content-type": "application/json",
    });
  });

  it("matches header names case-insensitively", () => {
    expect(isSensitiveHeader("X-Access-Token")).toBe(true);
    expect(isSensitiveHeader("Set-Cookie")).toBe(true);
    expect(isSensitiveHeader("X-Build")).toBe(false);
  });

  it("stores ingested events with sensitive headers redacted", async () => {
    const webhook = await createWebhook("Billing");

    await sendRaw(webhook.ingestPath, {
      method: "POST",
      headers: {
        Authorization: "Bearer sk_live_123",
        "X-Api-Key": "abc",
        "Stripe-Signature": "t=1,v1=abc",
        "X-Build": "42",
      },
      body: "{}",
    });

    const events = await request(`/api/webhooks/${webhook.id}/events`, {
      token: webhook.token,
    });
    expect(events.body.items[0].headers).toMatchObject({
      authorization: "[redacted]",
      "x-api-key": "[redacted]",
      "stripe-signature": "t=1,v1=abc",
      "x-build": "42",
    });
  });
});

describe("webhook ingest URLs", () => {
  it("builds slugs from a readable prefix and 128 random bits", () => {
    const slug = toSlug("Stripe Events! For the whole billing platform");

    expect(slug).toMatch(/^stripe-events-for-the-wh-[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(slug.slice(-22), "base64url")).toHaveLength(16);
    expect(toSlug("!!!")).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(toSlug("Deploys")).not.toBe(toSlug("Deploys"));
  });

  it("keeps accepting events on existing short slugs", async () => {
    const webhook = await createWebhook("Legacy");
    await db
      .update(webhooks)
      .set({ slug: "legacy-a1b2c3" })
      .where(eq(webhooks.id, webhook.id));

    const response = await sendRaw("/hooks/legacy-a1b2c3", {
      method: "POST",
      body: "{}",
    });
    expect(response.status).toBe(202);
  });

  it("rate limits slug guessing per source IP", async () => {
    const limit = env.WEBHOOK_INGEST_PER_IP_PER_MINUTE;
    const guesses = Array.from({ length: limit }, (_, index) => `guess-${index}`);

    for (let start = 0; start < guesses.length; start += 50) {
      const statuses = await Promise.all(
        guesses
          .slice(start, start + 50)
          .map(async (slug) => (await sendRaw(`/hooks/${slug}`, { method: "POST", body: "{}" })).status),
      );
      expect(new Set(statuses)).toEqual(new Set([404]));
    }

    const blocked = await sendRaw("/hooks/one-more-guess", {
      method: "POST",
      body: "{}",
    });
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });

  it("rejects bodies above the configured limit", async () => {
    const webhook = await createWebhook("Large");

    const response = await sendRaw(webhook.ingestPath, {
      method: "POST",
      body: "x".repeat(env.WEBHOOK_MAX_BODY_BYTES + 1),
    });
    expect(response.status).toBe(400);
    expect(await storedEventCount(webhook.id)).toBe(0);
  });
});

describe("webhook event retention", () => {
  it("caps the events list page size", async () => {
    const webhook = await createWebhook("Paged");

    const tooLarge = await request(`/api/webhooks/${webhook.id}/events?pageSize=26`, {
      token: webhook.token,
    });
    expect(tooLarge.status).toBe(400);

    const largest = await request(`/api/webhooks/${webhook.id}/events?pageSize=25`, {
      token: webhook.token,
    });
    expect(largest.status).toBe(200);
  });

  it("trims an endpoint to its cap while ingesting and keeps the lifetime count", async () => {
    const cap = env.WEBHOOK_MAX_EVENTS_PER_ENDPOINT;
    const webhook = await createWebhook("Busy");
    await insertEvents(webhook.id, minutesAgoList(cap + 10));
    await db
      .update(webhooks)
      .set({ eventCount: 49 })
      .where(eq(webhooks.id, webhook.id));

    const ingest = await sendRaw(webhook.ingestPath, { method: "POST", body: "latest" });
    expect(ingest.status).toBe(202);

    expect(await storedEventCount(webhook.id)).toBe(cap);
    const events = await request(`/api/webhooks/${webhook.id}/events`, {
      token: webhook.token,
    });
    expect(events.body.total).toBe(cap);
    expect(events.body.items[0].body).toBe("latest");

    const updated = await request(`/api/webhooks/${webhook.id}`, { token: webhook.token });
    expect(updated.body.eventCount).toBe(50);
  });

  it("deletes expired events and trims every endpoint during cleanup", async () => {
    const cap = env.WEBHOOK_MAX_EVENTS_PER_ENDPOINT;
    const busy = await createWebhook("Busy");
    const quiet = await createWebhook("Quiet", busy);
    const retentionCutoff = daysAgo(env.WEBHOOK_EVENT_RETENTION_DAYS);

    await insertEvents(busy.id, minutesAgoList(cap + 5));
    await insertEvents(quiet.id, [
      ...minutesAgoList(3),
      daysAgo(env.WEBHOOK_EVENT_RETENTION_DAYS + 1),
      daysAgo(env.WEBHOOK_EVENT_RETENTION_DAYS + 10),
    ]);

    await cleanUpOldData();

    expect(await storedEventCount(busy.id)).toBe(cap);
    expect((await oldestEvent(busy.id))?.getTime()).toBeGreaterThan(
      minutesFromNow(-(cap + 1)).getTime(),
    );
    expect(await storedEventCount(quiet.id)).toBe(3);
    expect((await oldestEvent(quiet.id))?.getTime()).toBeGreaterThan(
      retentionCutoff.getTime(),
    );
  });
});

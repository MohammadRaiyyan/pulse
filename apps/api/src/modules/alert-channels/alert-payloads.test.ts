import { Response } from "undici";
import { describe, expect, it } from "vitest";
import type { SafeFetchOptions } from "../../lib/outbound-http.ts";
import type { IncidentRecord } from "../incidents/incident.repository.ts";
import { deliverToChannel } from "./alert-delivery.service.ts";
import {
  type Alert,
  DISCORD_COLORS,
  type DeliveryChannel,
  PAGERDUTY_EVENTS_URL,
  buildDiscordPayload,
  buildOpsgenieRequests,
  buildPagerDutyEvents,
  buildTeamsPayload,
} from "./alert-payloads.ts";

const incident: IncidentRecord = {
  id: "8f6c5d2e-1b3a-4c7d-9e0f-123456789abc",
  source: {
    type: "monitor",
    id: "1d2c3b4a-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    name: "Checkout API",
    isDeleted: false,
  },
  status: "open",
  severity: "critical",
  cause: "HTTP 503 from https://shop.test/health",
  startedAt: new Date("2026-11-20T10:00:00.000Z"),
  acknowledgedAt: null,
  acknowledgedBy: null,
  resolvedAt: null,
  resolvedBy: null,
  resolutionReason: null,
};

const opened: Alert = {
  event: "incident.opened",
  incident,
  deliveryId: "delivery-1",
};
const resolved: Alert = { ...opened, event: "incident.resolved" };
const testAlert: Alert = {
  event: "test",
  incident: undefined,
  deliveryId: "delivery-2",
};

const ROUTING_KEY = "R0123456789abcdefABCDEF012345678";
const OPSGENIE_KEY = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

type SentRequest = { url: string; options: SafeFetchOptions };

const stubFetcher = (status = 202, body = '{"status":"success"}') => {
  const sent: SentRequest[] = [];
  const fetcher = async (url: string, options: SafeFetchOptions) => {
    sent.push({ url, options });
    return new Response(body || null, { status });
  };
  return { sent, fetcher };
};

const channel = (
  overrides: Partial<DeliveryChannel> & Pick<DeliveryChannel, "type">,
): DeliveryChannel => ({
  id: "channel-1",
  target: "https://receiver.test/hook",
  region: null,
  signingSecret: "whsec_test",
  ...overrides,
});

const bodies = (sent: SentRequest[]) =>
  sent.map(({ options }) => JSON.parse(options.body ?? ""));

describe("Microsoft Teams payload", () => {
  it("builds an Adaptive Card with severity, cause, source and a link", () => {
    const payload = buildTeamsPayload(opened);
    const [attachment] = payload.attachments;

    expect(attachment?.contentType).toBe(
      "application/vnd.microsoft.card.adaptive",
    );
    expect(attachment?.content).toMatchObject({
      type: "AdaptiveCard",
      body: [
        { type: "TextBlock", text: "[Incident] Checkout API is failing" },
        { type: "TextBlock" },
        {
          type: "FactSet",
          facts: [
            { title: "Severity", value: "Critical" },
            { title: "Cause", value: incident.cause },
            { title: "Source", value: "Checkout API (monitor)" },
          ],
        },
      ],
      actions: [
        {
          type: "Action.OpenUrl",
          title: "View incident",
          url: "http://localhost:5173/incidents",
        },
      ],
    });
  });

  it("sends a test card without incident facts", () => {
    const content = buildTeamsPayload(testAlert).attachments[0]?.content;

    expect(content?.body).toHaveLength(2);
    expect(content?.body[0]).toMatchObject({ text: "Pulse test alert" });
    expect(content?.actions[0]).toMatchObject({ title: "Open Pulse" });
  });
});

describe("Discord payload", () => {
  it("colors embeds by event and blocks mentions", () => {
    expect(buildDiscordPayload(opened)).toMatchObject({
      content: `[Incident] Checkout API: ${incident.cause}`,
      allowed_mentions: { parse: [] },
      embeds: [
        {
          title: "[Incident] Checkout API is failing",
          color: DISCORD_COLORS["incident.opened"],
          url: "http://localhost:5173/incidents",
          fields: [
            { name: "Severity", value: "Critical", inline: true },
            { name: "Cause", value: incident.cause, inline: false },
            { name: "Source", value: "Checkout API (monitor)", inline: true },
          ],
        },
      ],
    });
    expect(buildDiscordPayload(resolved).embeds[0]?.color).toBe(0x16a34a);
    expect(buildDiscordPayload(testAlert).embeds[0]).toMatchObject({
      color: 0x64748b,
      fields: [],
    });
  });

  it("delivers through the fetcher", async () => {
    const { sent, fetcher } = stubFetcher(204, "");
    await deliverToChannel(
      channel({
        type: "discord",
        target: "https://discord.com/api/webhooks/1/abc",
      }),
      opened,
      1_000,
      fetcher,
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe("https://discord.com/api/webhooks/1/abc");
    expect(sent[0]?.options.headers?.["Content-Type"]).toBe("application/json");
  });
});

describe("PagerDuty events", () => {
  it("triggers with the incident id as dedup key and mapped severity", () => {
    const [event] = buildPagerDutyEvents(ROUTING_KEY, opened);

    expect(event).toMatchObject({
      routing_key: ROUTING_KEY,
      event_action: "trigger",
      dedup_key: incident.id,
      payload: {
        summary: `Checkout API: ${incident.cause}`,
        source: "Checkout API",
        severity: "critical",
        timestamp: "2026-11-20T10:00:00.000Z",
      },
      links: [{ href: "http://localhost:5173/incidents" }],
    });

    const warning = buildPagerDutyEvents(ROUTING_KEY, {
      ...opened,
      incident: { ...incident, severity: "warning" },
    });
    expect(warning[0]?.payload?.severity).toBe("warning");
  });

  it("resolves with the same dedup key", async () => {
    const { sent, fetcher } = stubFetcher();
    const pagerduty = channel({ type: "pagerduty", target: ROUTING_KEY });

    await deliverToChannel(pagerduty, opened, 1_000, fetcher);
    await deliverToChannel(pagerduty, resolved, 1_000, fetcher);

    expect(sent.map(({ url }) => url)).toEqual([
      PAGERDUTY_EVENTS_URL,
      PAGERDUTY_EVENTS_URL,
    ]);
    const [trigger, resolve] = bodies(sent);
    expect(trigger.dedup_key).toBe(incident.id);
    expect(resolve).toEqual({
      routing_key: ROUTING_KEY,
      event_action: "resolve",
      dedup_key: incident.id,
    });
  });

  it("tests with an info trigger followed by a resolve", async () => {
    const { sent, fetcher } = stubFetcher();
    await deliverToChannel(
      channel({ type: "pagerduty", target: ROUTING_KEY }),
      testAlert,
      1_000,
      fetcher,
    );

    const [trigger, resolve] = bodies(sent);
    expect(trigger).toMatchObject({
      event_action: "trigger",
      dedup_key: "pulse-test-delivery-2",
      payload: { severity: "info" },
    });
    expect(resolve).toMatchObject({
      event_action: "resolve",
      dedup_key: "pulse-test-delivery-2",
    });
  });

  it("reports the PagerDuty error message", async () => {
    const { fetcher } = stubFetcher(
      400,
      '{"status":"invalid event","message":"Event object is invalid"}',
    );

    await expect(
      deliverToChannel(
        channel({ type: "pagerduty", target: ROUTING_KEY }),
        opened,
        1_000,
        fetcher,
      ),
    ).rejects.toThrow(
      "Receiver answered with HTTP 400: Event object is invalid",
    );
  });

  it("refuses incident events without an incident", () => {
    expect(() =>
      buildPagerDutyEvents(ROUTING_KEY, { ...opened, incident: undefined }),
    ).toThrow("no longer exists");
  });
});

describe("Opsgenie requests", () => {
  it("creates an alert aliased to the incident id on the regional host", () => {
    const [request] = buildOpsgenieRequests(OPSGENIE_KEY, "eu", opened);

    expect(request?.url).toBe("https://api.eu.opsgenie.com/v2/alerts");
    expect(request?.headers).toEqual({
      Authorization: `GenieKey ${OPSGENIE_KEY}`,
    });
    expect(JSON.parse(request?.body ?? "")).toMatchObject({
      alias: incident.id,
      message: `Checkout API: ${incident.cause}`,
      priority: "P1",
      source: "Pulse",
      entity: "Checkout API",
    });
  });

  it("closes the alert by alias when the incident resolves", async () => {
    const { sent, fetcher } = stubFetcher();
    await deliverToChannel(
      channel({ type: "opsgenie", target: OPSGENIE_KEY, region: "us" }),
      resolved,
      1_000,
      fetcher,
    );

    expect(sent[0]?.url).toBe(
      `https://api.opsgenie.com/v2/alerts/${incident.id}/close?identifierType=alias`,
    );
    expect(sent[0]?.options.headers?.Authorization).toBe(
      `GenieKey ${OPSGENIE_KEY}`,
    );
    expect(bodies(sent)[0]).toMatchObject({ source: "Pulse" });
  });

  it("maps warnings to P3 and sends tests as P5 alerts", () => {
    const [warning] = buildOpsgenieRequests(OPSGENIE_KEY, "us", {
      ...opened,
      incident: { ...incident, severity: "warning" },
    });
    expect(JSON.parse(warning?.body ?? "").priority).toBe("P3");

    const [test] = buildOpsgenieRequests(OPSGENIE_KEY, "us", testAlert);
    expect(test?.url).toBe("https://api.opsgenie.com/v2/alerts");
    expect(JSON.parse(test?.body ?? "")).toMatchObject({
      alias: "pulse-test-delivery-2",
      priority: "P5",
    });
  });

  it("reports an invalid key", async () => {
    const { fetcher } = stubFetcher(
      422,
      '{"message":"Key format is not valid!","took":0.001}',
    );

    await expect(
      deliverToChannel(
        channel({ type: "opsgenie", target: OPSGENIE_KEY, region: "eu" }),
        testAlert,
        1_000,
        fetcher,
      ),
    ).rejects.toThrow(
      "Receiver answered with HTTP 422: Key format is not valid!",
    );
  });
});

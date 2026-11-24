import type { Webhook, WebhookEvent } from "@pulse/contracts";
import { ingestUrlFor } from "../lib/app-url";
import { seedId } from "../lib/ids";
import { minutesAgo } from "../lib/time";

const WEBHOOK_NAMESPACE = 10;
const EVENT_NAMESPACE = 11;
const STRIPE_EVENT_COUNT = 24;

const stripeEvent = (webhookId: string, index: number): WebhookEvent => ({
  id: seedId(EVENT_NAMESPACE, index + 1),
  webhookId,
  method: "POST",
  headers: {
    "content-type": "application/json",
    "stripe-signature": `t=${1_700_000_000 + index},v1=signature${index}`,
    "user-agent": "Stripe/1.0",
  },
  body: JSON.stringify({
    id: `evt_${index.toString().padStart(4, "0")}`,
    type: index % 3 === 0 ? "invoice.paid" : "charge.succeeded",
    data: { object: { amount: 1_000 + index * 250, currency: "usd" } },
  }),
  contentType: "application/json",
  sourceIp: "54.187.174.169",
  receivedAt: minutesAgo(index * 45 + 3),
});

export const seedWebhooks = (channelIds: readonly string[]) => {
  const stripeId = seedId(WEBHOOK_NAMESPACE, 1);
  const githubId = seedId(WEBHOOK_NAMESPACE, 2);
  const stripeEvents = Array.from({ length: STRIPE_EVENT_COUNT }, (_, index) =>
    stripeEvent(stripeId, index),
  );

  const webhooks: Webhook[] = [
    {
      id: stripeId,
      name: "Stripe events",
      ingestUrl: ingestUrlFor("stripe-events"),
      expectedIntervalSeconds: 3_600,
      alertChannelIds: channelIds.slice(0, 1),
      serviceId: null,
      status: "active",
      eventCount: stripeEvents.length,
      lastReceivedAt: stripeEvents[0]?.receivedAt ?? null,
      createdAt: minutesAgo(30_000),
    },
    {
      id: githubId,
      name: "GitHub deploys",
      ingestUrl: ingestUrlFor("github-deploys"),
      expectedIntervalSeconds: 86_400,
      alertChannelIds: channelIds.slice(1, 2),
      serviceId: null,
      status: "silent",
      eventCount: 0,
      lastReceivedAt: null,
      createdAt: minutesAgo(5_000),
    },
  ];

  const events = new Map<string, WebhookEvent[]>([
    [stripeId, stripeEvents],
    [githubId, []],
  ]);

  return { webhooks, events };
};

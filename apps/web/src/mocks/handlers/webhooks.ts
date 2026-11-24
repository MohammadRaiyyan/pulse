import {
  type CreateWebhookInput,
  type UpdateWebhookInput,
  type Webhook,
  endpoints,
  resources,
} from "@pulse/contracts";
import { db } from "../db";
import { ingestUrlFor } from "../lib/app-url";
import { childListHandler } from "../lib/child-list";
import { crudHandlers } from "../lib/crud";
import { newId } from "../lib/ids";
import {
  assertChannelsExist,
  channelLinkedSourceHooks,
} from "../lib/relations";
import { now } from "../lib/time";

const LABEL = "Webhook";
const SLUG_SUFFIX_LENGTH = 6;

const toSlug = (name: string) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${newId().slice(0, SLUG_SUFFIX_LENGTH)}`;

const toWebhook = (input: CreateWebhookInput): Webhook => {
  assertChannelsExist(input.alertChannelIds);

  return {
    ...input,
    id: newId(),
    serviceId: input.serviceId ?? null,
    ingestUrl: ingestUrlFor(toSlug(input.name)),
    status: "pending",
    eventCount: 0,
    lastReceivedAt: null,
    createdAt: now(),
  };
};

const applyWebhookUpdate = (
  webhook: Webhook,
  input: UpdateWebhookInput,
): Webhook => {
  assertChannelsExist(input.alertChannelIds);

  return { ...webhook, ...input };
};

export const webhookHandlers = [
  ...crudHandlers(resources.webhooks, {
    label: LABEL,
    store: db.webhooks,
    sortKey: (webhook) => webhook.createdAt,
    toItem: toWebhook,
    applyUpdate: applyWebhookUpdate,
    ...channelLinkedSourceHooks((webhook) =>
      db.webhookEvents.delete(webhook.id),
    ),
  }),
  childListHandler(endpoints.listWebhookEvents, {
    label: LABEL,
    parents: db.webhooks,
    children: db.webhookEvents,
    sortKey: (event) => event.receivedAt,
  }),
];

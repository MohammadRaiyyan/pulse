import { randomBytes } from "node:crypto";
import type {
  CreateWebhookInput,
  PaginationQuery,
  UpdateWebhookInput,
  WebhookEventListQuery,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { cacheKeys, invalidate, statusCacheKeys } from "../../lib/cache.ts";
import { daysAgo, formatDuration } from "../../lib/dates.ts";
import { notFound } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import { publishChange } from "../../lib/realtime.ts";
import type { WebhookRow } from "../../models/index.ts";
import {
  closeIncidentsForSource,
  openIncidentForSource,
  renameIncidentSource,
  resolveIncidentForSource,
} from "../incidents/incident.service.ts";
import {
  type IncomingEvent,
  clearSilenceIfNoLongerOverdue,
  deleteEventsBeyondLimit,
  deleteEventsBeyondLimitForWebhook,
  deleteEventsOlderThan,
  deleteWebhook,
  findChannelIdsByWebhookIds,
  findChannelIdsForWebhook,
  findWebhook,
  findWebhookIdBySlug,
  insertWebhook,
  listEvents,
  listWebhooks,
  markOverdueWebhooksSilent,
  saveIncomingEvent,
  updateWebhook,
} from "./webhook.repository.ts";
import { redactHeaders } from "./header-redaction.ts";

const LABEL = "Webhook";
const SLUG_PREFIX_LENGTH = 24;
const SLUG_TOKEN_BYTES = 16;
const EVENT_TRIM_INTERVAL = 50;

export const toSlug = (name: string) => {
  const prefix = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, SLUG_PREFIX_LENGTH)
    .replace(/(^-+|-+$)/g, "");
  const token = randomBytes(SLUG_TOKEN_BYTES).toString("base64url");

  return prefix ? `${prefix}-${token}` : token;
};

const withPublicFields = (webhook: WebhookRow, alertChannelIds: string[]) => {
  const { slug, ...fields } = webhook;

  return {
    ...fields,
    ingestUrl: new URL(`/hooks/${slug}`, env.APP_URL).href,
    alertChannelIds,
  };
};

export const getWebhooks = async (query: PaginationQuery) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listWebhooks(limit, offset);
  const channelIds = await findChannelIdsByWebhookIds(
    rows.map((row) => row.id),
  );

  const items = rows.map((webhook) =>
    withPublicFields(webhook, channelIds.get(webhook.id) ?? []),
  );

  return toPage(items, total, query);
};

export const getWebhook = async (id: string) => {
  const [webhook, alertChannelIds] = await Promise.all([
    findWebhook(id),
    findChannelIdsForWebhook(id),
  ]);

  if (!webhook) {
    throw notFound(LABEL);
  }

  return withPublicFields(webhook, alertChannelIds);
};

export const createWebhook = async (input: CreateWebhookInput) => {
  const webhook = await insertWebhook(
    {
      name: input.name,
      slug: toSlug(input.name),
      expectedIntervalSeconds: input.expectedIntervalSeconds,
      serviceId: input.serviceId ?? null,
    },
    input.alertChannelIds,
  );

  await invalidate(...statusCacheKeys);
  publishChange({ type: "webhook.updated", id: webhook.id });

  return withPublicFields(webhook, input.alertChannelIds);
};

export const updateWebhookById = async (
  id: string,
  input: UpdateWebhookInput,
) => {
  const webhook = await updateWebhook(id, input);

  if (!webhook) {
    throw notFound(LABEL);
  }

  if (input.name) {
    await renameIncidentSource(id, input.name);
  }

  const alertChannelIds =
    input.alertChannelIds ?? (await findChannelIdsForWebhook(id));

  const recovered =
    input.expectedIntervalSeconds !== undefined
      ? await clearSilenceIfNoLongerOverdue(id)
      : undefined;
  await invalidate(cacheKeys.publicStatus);
  publishChange({ type: "webhook.updated", id });

  if (!recovered) {
    return withPublicFields(webhook, alertChannelIds);
  }

  await resolveIncidentForSource({
    type: "webhook",
    id,
    name: webhook.name,
    alertChannelIds,
  });
  await invalidate(...statusCacheKeys);

  return withPublicFields({ ...webhook, status: recovered.status }, alertChannelIds);
};

export const removeWebhook = async (id: string) => {
  const webhook = await deleteWebhook(id);

  if (!webhook) {
    throw notFound(LABEL);
  }

  await closeIncidentsForSource(id);
  await invalidate(...statusCacheKeys);
  publishChange({ type: "webhook.deleted", id });
};

export const getWebhookEvents = async (
  webhookId: string,
  query: WebhookEventListQuery,
) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listEvents(webhookId, limit, offset);
  return toPage(rows, total, query);
};

export const receiveWebhookEvent = async (
  slug: string,
  event: IncomingEvent,
) => {
  const webhookId = await findWebhookIdBySlug(slug);

  if (!webhookId) {
    throw notFound(LABEL);
  }

  const webhook = await saveIncomingEvent(webhookId, {
    ...event,
    headers: redactHeaders(event.headers),
  });

  if (!webhook) {
    throw notFound(LABEL);
  }

  if (webhook.eventCount % EVENT_TRIM_INTERVAL === 0) {
    await deleteEventsBeyondLimitForWebhook(
      webhook.id,
      env.WEBHOOK_MAX_EVENTS_PER_ENDPOINT,
    );
  }

  if (webhook.status !== "active") {
    await invalidate(...statusCacheKeys);
  }

  if (webhook.status === "silent") {
    await resolveIncidentForSource({
      type: "webhook",
      id: webhook.id,
      name: webhook.name,
      alertChannelIds: await findChannelIdsForWebhook(webhook.id),
    });
  }

  publishChange({ type: "webhook.event", id: webhook.id });
};

export const detectSilentWebhooks = async () => {
  const silentWebhooks = await markOverdueWebhooksSilent();

  if (silentWebhooks.length === 0) {
    return;
  }

  const channelIds = await findChannelIdsByWebhookIds(
    silentWebhooks.map((webhook) => webhook.id),
  );

  for (const webhook of silentWebhooks) {
    logger.info({ webhook: webhook.name }, "Webhook went silent");
    publishChange({ type: "webhook.updated", id: webhook.id });

    await openIncidentForSource(
      {
        type: "webhook",
        id: webhook.id,
        name: webhook.name,
        alertChannelIds: channelIds.get(webhook.id) ?? [],
      },
      `No events received within ${formatDuration(webhook.expectedIntervalSeconds ?? 0)}`,
    );
  }

  await invalidate(...statusCacheKeys);
};

export const pruneWebhookEvents = async () => {
  await deleteEventsOlderThan(daysAgo(env.WEBHOOK_EVENT_RETENTION_DAYS));
  await deleteEventsBeyondLimit(env.WEBHOOK_MAX_EVENTS_PER_ENDPOINT);
};

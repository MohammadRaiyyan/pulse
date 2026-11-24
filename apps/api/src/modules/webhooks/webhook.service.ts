import { randomBytes } from "node:crypto";
import type {
  CreateWebhookInput,
  PaginationQuery,
  UpdateWebhookInput,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { cacheKeys, invalidate } from "../../lib/cache.ts";
import { formatDuration } from "../../lib/dates.ts";
import { notFound } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
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
  deleteWebhook,
  findChannelIdsByWebhookIds,
  findChannelIdsForWebhook,
  findWebhook,
  insertWebhook,
  listEvents,
  listWebhooks,
  markOverdueWebhooksSilent,
  saveIncomingEvent,
  updateWebhook,
} from "./webhook.repository.ts";

const LABEL = "Webhook";

const toSlug = (name: string) => {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  const suffix = randomBytes(3).toString("hex");

  return base ? `${base}-${suffix}` : suffix;
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
    },
    input.alertChannelIds,
  );

  await invalidate(cacheKeys.dashboardSummary);

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

  if (!recovered) {
    return withPublicFields(webhook, alertChannelIds);
  }

  await resolveIncidentForSource({
    type: "webhook",
    id,
    name: webhook.name,
    alertChannelIds,
  });
  await invalidate(cacheKeys.dashboardSummary);

  return withPublicFields({ ...webhook, status: recovered.status }, alertChannelIds);
};

export const removeWebhook = async (id: string) => {
  const webhook = await deleteWebhook(id);

  if (!webhook) {
    throw notFound(LABEL);
  }

  await closeIncidentsForSource(id);
  await invalidate(cacheKeys.dashboardSummary);
};

export const getWebhookEvents = async (
  webhookId: string,
  query: PaginationQuery,
) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listEvents(webhookId, limit, offset);
  return toPage(rows, total, query);
};

export const receiveWebhookEvent = async (
  slug: string,
  event: IncomingEvent,
) => {
  const webhook = await saveIncomingEvent(slug, event);

  if (!webhook) {
    throw notFound(LABEL);
  }

  if (webhook.status !== "active") {
    await invalidate(cacheKeys.dashboardSummary);
  }

  if (webhook.status === "silent") {
    await resolveIncidentForSource({
      type: "webhook",
      id: webhook.id,
      name: webhook.name,
      alertChannelIds: await findChannelIdsForWebhook(webhook.id),
    });
  }
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

  await invalidate(cacheKeys.dashboardSummary);
};

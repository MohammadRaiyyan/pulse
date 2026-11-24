import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  lt,
  ne,
  sql,
} from "drizzle-orm";
import { type Transaction, db } from "../../db/client.ts";
import {
  webhookAlertChannels,
  webhookEvents,
  webhooks,
} from "../../models/index.ts";

type WebhookValues = {
  name: string;
  slug: string;
  expectedIntervalSeconds: number | null;
};

type WebhookChanges = {
  name?: string;
  expectedIntervalSeconds?: number | null;
  alertChannelIds?: string[];
};

export type IncomingEvent = {
  method: string;
  headers: Record<string, string>;
  body: string;
  contentType: string | null;
  sourceIp: string;
};

export const listWebhooks = async (limit: number, offset: number) => {
  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(webhooks)
      .orderBy(desc(webhooks.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(webhooks),
  ]);

  return { rows, total: totalRow?.total ?? 0 };
};

export const findWebhook = async (id: string) => {
  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id));
  return webhook;
};

export const findChannelIdsByWebhookIds = async (webhookIds: string[]) => {
  const channelIdsByWebhook = new Map<string, string[]>();

  for (const webhookId of webhookIds) {
    channelIdsByWebhook.set(webhookId, []);
  }

  if (webhookIds.length === 0) {
    return channelIdsByWebhook;
  }

  const links = await db
    .select()
    .from(webhookAlertChannels)
    .where(inArray(webhookAlertChannels.webhookId, webhookIds));

  for (const link of links) {
    channelIdsByWebhook.get(link.webhookId)?.push(link.channelId);
  }

  return channelIdsByWebhook;
};

const replaceChannelLinks = async (
  tx: Transaction,
  webhookId: string,
  channelIds: string[],
) => {
  await tx
    .delete(webhookAlertChannels)
    .where(eq(webhookAlertChannels.webhookId, webhookId));

  if (channelIds.length > 0) {
    const uniqueIds = [...new Set(channelIds)];
    await tx
      .insert(webhookAlertChannels)
      .values(uniqueIds.map((channelId) => ({ webhookId, channelId })));
  }
};

export const insertWebhook = (
  values: WebhookValues,
  alertChannelIds: string[],
) =>
  db.transaction(async (tx) => {
    const [webhook] = await tx.insert(webhooks).values(values).returning();

    if (!webhook) {
      throw new Error("Failed to insert webhook");
    }

    await replaceChannelLinks(tx, webhook.id, alertChannelIds);

    return webhook;
  });

export const updateWebhook = (id: string, changes: WebhookChanges) =>
  db.transaction(async (tx) => {
    const { alertChannelIds, ...values } = changes;
    const hasValues =
      values.name !== undefined || values.expectedIntervalSeconds !== undefined;

    const [webhook] = hasValues
      ? await tx
          .update(webhooks)
          .set(values)
          .where(eq(webhooks.id, id))
          .returning()
      : await tx.select().from(webhooks).where(eq(webhooks.id, id));

    if (webhook && alertChannelIds) {
      await replaceChannelLinks(tx, id, alertChannelIds);
    }

    return webhook;
  });

export const deleteWebhook = async (id: string) => {
  const [webhook] = await db
    .delete(webhooks)
    .where(eq(webhooks.id, id))
    .returning({ id: webhooks.id });
  return webhook;
};

export const findChannelIdsForWebhook = async (webhookId: string) => {
  const channelIds = await findChannelIdsByWebhookIds([webhookId]);
  return channelIds.get(webhookId) ?? [];
};

export const listEvents = async (
  webhookId: string,
  limit: number,
  offset: number,
) => {
  const where = eq(webhookEvents.webhookId, webhookId);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(webhookEvents)
      .where(where)
      .orderBy(desc(webhookEvents.receivedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(webhookEvents).where(where),
  ]);

  return { rows, total: totalRow?.total ?? 0 };
};

export const saveIncomingEvent = (slug: string, event: IncomingEvent) =>
  db.transaction(async (tx) => {
    const receivedAt = new Date();

    const [previous] = await tx
      .select({ id: webhooks.id, name: webhooks.name, status: webhooks.status })
      .from(webhooks)
      .where(eq(webhooks.slug, slug))
      .for("update");

    if (!previous) {
      return undefined;
    }

    await tx
      .insert(webhookEvents)
      .values({ webhookId: previous.id, receivedAt, ...event });

    await tx
      .update(webhooks)
      .set({
        status: "active",
        lastReceivedAt: receivedAt,
        eventCount: sql`${webhooks.eventCount} + 1`,
      })
      .where(eq(webhooks.id, previous.id));

    return previous;
  });

export const markOverdueWebhooksSilent = () =>
  db
    .update(webhooks)
    .set({ status: "silent" })
    .where(
      and(
        isNotNull(webhooks.expectedIntervalSeconds),
        ne(webhooks.status, "silent"),
        lt(
          sql`coalesce(${webhooks.lastReceivedAt}, ${webhooks.createdAt}) + make_interval(secs => ${webhooks.expectedIntervalSeconds})`,
          sql`now()`,
        ),
      ),
    )
    .returning({
      id: webhooks.id,
      name: webhooks.name,
      expectedIntervalSeconds: webhooks.expectedIntervalSeconds,
    });

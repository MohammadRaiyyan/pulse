import type { AlertChannelType } from "@pulse/contracts";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { alertChannels } from "../../models/index.ts";
import { findLatestDeliveries } from "./alert-delivery.repository.ts";

const alertChannelColumns = {
  id: alertChannels.id,
  name: alertChannels.name,
  isEnabled: alertChannels.isEnabled,
  destination: {
    type: alertChannels.type,
    target: alertChannels.target,
  },
  createdAt: alertChannels.createdAt,
};

type AlertChannelValues = {
  name: string;
  isEnabled: boolean;
  type: AlertChannelType;
  target: string;
};

type ChannelRow = { id: string };

const withLastDelivery = async <TChannel extends ChannelRow>(
  channels: TChannel[],
) => {
  const latest = await findLatestDeliveries(
    channels.map((channel) => channel.id),
  );

  return channels.map((channel) => ({
    ...channel,
    lastDelivery: latest.get(channel.id) ?? null,
  }));
};

const isWebhookChannel = (id: string) =>
  and(eq(alertChannels.id, id), eq(alertChannels.type, "webhook"));

export const listAlertChannels = async (limit: number, offset: number) => {
  const [rows, [totalRow]] = await Promise.all([
    db
      .select(alertChannelColumns)
      .from(alertChannels)
      .orderBy(desc(alertChannels.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(alertChannels),
  ]);

  return { rows: await withLastDelivery(rows), total: totalRow?.total ?? 0 };
};

export const findAlertChannel = async (id: string) => {
  const rows = await db
    .select(alertChannelColumns)
    .from(alertChannels)
    .where(eq(alertChannels.id, id));
  const [channel] = await withLastDelivery(rows);
  return channel;
};

export const findChannelForDelivery = async (id: string) => {
  const [channel] = await db
    .select({
      id: alertChannels.id,
      isEnabled: alertChannels.isEnabled,
      type: alertChannels.type,
      target: alertChannels.target,
      signingSecret: alertChannels.signingSecret,
    })
    .from(alertChannels)
    .where(eq(alertChannels.id, id));
  return channel;
};

export const findSigningSecret = async (id: string) => {
  const [secret] = await db
    .select({ signingSecret: alertChannels.signingSecret })
    .from(alertChannels)
    .where(isWebhookChannel(id));
  return secret;
};

export const updateSigningSecret = async (id: string, signingSecret: string) => {
  const [secret] = await db
    .update(alertChannels)
    .set({ signingSecret })
    .where(isWebhookChannel(id))
    .returning({ signingSecret: alertChannels.signingSecret });
  return secret;
};

export const insertAlertChannel = async (values: AlertChannelValues) => {
  const [inserted] = await db
    .insert(alertChannels)
    .values(values)
    .returning({ id: alertChannels.id });
  const channel = inserted ? await findAlertChannel(inserted.id) : undefined;

  if (!channel) {
    throw new Error("Failed to insert alert channel");
  }

  return channel;
};

export const updateAlertChannel = async (
  id: string,
  changes: Partial<AlertChannelValues>,
) => {
  const rows = await db
    .update(alertChannels)
    .set(changes)
    .where(eq(alertChannels.id, id))
    .returning(alertChannelColumns);
  const [channel] = await withLastDelivery(rows);
  return channel;
};

export const deleteAlertChannel = async (id: string) => {
  const [channel] = await db
    .delete(alertChannels)
    .where(eq(alertChannels.id, id))
    .returning({ id: alertChannels.id });
  return channel;
};

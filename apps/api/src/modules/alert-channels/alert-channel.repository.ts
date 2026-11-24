import type { AlertChannelType } from "@pulse/contracts";
import { count, desc, eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { alertChannels } from "../../models/index.ts";

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

  return { rows, total: totalRow?.total ?? 0 };
};

export const findAlertChannel = async (id: string) => {
  const [channel] = await db
    .select(alertChannelColumns)
    .from(alertChannels)
    .where(eq(alertChannels.id, id));
  return channel;
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
  const [channel] = await db
    .update(alertChannels)
    .set(changes)
    .where(eq(alertChannels.id, id))
    .returning(alertChannelColumns);
  return channel;
};

export const deleteAlertChannel = async (id: string) => {
  const [channel] = await db
    .delete(alertChannels)
    .where(eq(alertChannels.id, id))
    .returning({ id: alertChannels.id });
  return channel;
};

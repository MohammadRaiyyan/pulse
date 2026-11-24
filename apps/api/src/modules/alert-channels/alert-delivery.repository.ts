import type { AlertDeliveryStatus, AlertEvent } from "@pulse/contracts";
import { asc, count, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { alertDeliveries } from "../../models/index.ts";

const deliveryColumns = {
  id: alertDeliveries.id,
  event: alertDeliveries.event,
  incidentId: alertDeliveries.incidentId,
  status: alertDeliveries.status,
  attempts: alertDeliveries.attempts,
  lastError: alertDeliveries.lastError,
  createdAt: alertDeliveries.createdAt,
  updatedAt: alertDeliveries.updatedAt,
};

export type DeliveryRecord = {
  id: string;
  event: AlertEvent;
  incidentId: string | null;
  status: AlertDeliveryStatus;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DeliveryAttempt = {
  id: string;
  channelId: string;
  event: AlertEvent;
  incidentId: string | null;
  status: AlertDeliveryStatus;
  attempts: number;
  lastError: string | null;
};

export const saveDeliveryAttempt = async (attempt: DeliveryAttempt) => {
  const [delivery] = await db
    .insert(alertDeliveries)
    .values(attempt)
    .onConflictDoUpdate({
      target: alertDeliveries.id,
      set: {
        status: attempt.status,
        attempts: attempt.attempts,
        lastError: attempt.lastError,
        updatedAt: new Date(),
      },
    })
    .returning(deliveryColumns);

  if (!delivery) {
    throw new Error("Failed to save alert delivery");
  }

  return delivery;
};

export const findLatestDeliveries = async (channelIds: string[]) => {
  const latest = new Map<string, DeliveryRecord>();

  if (channelIds.length === 0) {
    return latest;
  }

  const rows = await db
    .selectDistinctOn([alertDeliveries.channelId], {
      ...deliveryColumns,
      channelId: alertDeliveries.channelId,
    })
    .from(alertDeliveries)
    .where(inArray(alertDeliveries.channelId, channelIds))
    .orderBy(asc(alertDeliveries.channelId), desc(alertDeliveries.createdAt));

  for (const { channelId, ...delivery } of rows) {
    latest.set(channelId, delivery);
  }

  return latest;
};

export const listDeliveriesForChannel = async (
  channelId: string,
  limit: number,
  offset: number,
) => {
  const where = eq(alertDeliveries.channelId, channelId);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(deliveryColumns)
      .from(alertDeliveries)
      .where(where)
      .orderBy(desc(alertDeliveries.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(alertDeliveries).where(where),
  ]);

  return { rows, total: totalRow?.total ?? 0 };
};

export const deleteDeliveriesOlderThan = async (cutoff: Date) => {
  await db.delete(alertDeliveries).where(lt(alertDeliveries.createdAt, cutoff));
};

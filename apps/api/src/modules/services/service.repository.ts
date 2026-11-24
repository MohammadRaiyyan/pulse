import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  ne,
  notInArray,
  sql,
} from "drizzle-orm";
import { type Transaction, db } from "../../db/client.ts";
import { badRequest } from "../../lib/errors.ts";
import {
  incidents,
  monitorDailyStats,
  monitors,
  services,
  webhooks,
} from "../../models/index.ts";
import { incidentColumns } from "../incidents/incident.repository.ts";

type ServiceValues = {
  name: string;
  description: string;
  isPublic: boolean;
  position: number;
};

type MemberIds = {
  monitorIds?: string[];
  webhookIds?: string[];
};

const serviceColumns = {
  id: services.id,
  name: services.name,
  description: services.description,
  isPublic: services.isPublic,
  position: services.position,
  createdAt: services.createdAt,
  updatedAt: services.updatedAt,
};

const displayOrder = [asc(services.position), asc(sql`lower(${services.name})`)];

export const listServices = async (limit: number, offset: number) => {
  const [rows, [totalRow]] = await Promise.all([
    db
      .select(serviceColumns)
      .from(services)
      .orderBy(...displayOrder)
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(services),
  ]);

  return { rows, total: totalRow?.total ?? 0 };
};

export const findService = async (id: string) => {
  const [service] = await db
    .select(serviceColumns)
    .from(services)
    .where(eq(services.id, id));
  return service;
};

export const listPublicServices = () =>
  db
    .select({
      id: services.id,
      name: services.name,
      description: services.description,
    })
    .from(services)
    .where(eq(services.isPublic, true))
    .orderBy(...displayOrder);

const assignMonitors = async (
  tx: Transaction,
  serviceId: string,
  monitorIds: string[],
) => {
  const uniqueIds = [...new Set(monitorIds)];

  await tx
    .update(monitors)
    .set({ serviceId: null })
    .where(
      and(
        eq(monitors.serviceId, serviceId),
        uniqueIds.length > 0 ? notInArray(monitors.id, uniqueIds) : undefined,
      ),
    );

  if (uniqueIds.length === 0) {
    return;
  }

  const assigned = await tx
    .update(monitors)
    .set({ serviceId })
    .where(inArray(monitors.id, uniqueIds))
    .returning({ id: monitors.id });

  if (assigned.length !== uniqueIds.length) {
    throw badRequest("Some fields are invalid", {
      monitorIds: ["Unknown monitor"],
    });
  }
};

const assignWebhooks = async (
  tx: Transaction,
  serviceId: string,
  webhookIds: string[],
) => {
  const uniqueIds = [...new Set(webhookIds)];

  await tx
    .update(webhooks)
    .set({ serviceId: null })
    .where(
      and(
        eq(webhooks.serviceId, serviceId),
        uniqueIds.length > 0 ? notInArray(webhooks.id, uniqueIds) : undefined,
      ),
    );

  if (uniqueIds.length === 0) {
    return;
  }

  const assigned = await tx
    .update(webhooks)
    .set({ serviceId })
    .where(inArray(webhooks.id, uniqueIds))
    .returning({ id: webhooks.id });

  if (assigned.length !== uniqueIds.length) {
    throw badRequest("Some fields are invalid", {
      webhookIds: ["Unknown webhook"],
    });
  }
};

const assignMembers = async (
  tx: Transaction,
  serviceId: string,
  { monitorIds, webhookIds }: MemberIds,
) => {
  if (monitorIds) {
    await assignMonitors(tx, serviceId, monitorIds);
  }

  if (webhookIds) {
    await assignWebhooks(tx, serviceId, webhookIds);
  }
};

export const insertService = (values: ServiceValues, members: MemberIds) =>
  db.transaction(async (tx) => {
    const [service] = await tx
      .insert(services)
      .values(values)
      .returning({ id: services.id });

    if (!service) {
      throw new Error("Failed to insert service");
    }

    await assignMembers(tx, service.id, members);

    return service;
  });

export const updateService = (
  id: string,
  changes: Partial<ServiceValues> & MemberIds,
) =>
  db.transaction(async (tx) => {
    const { monitorIds, webhookIds, ...values } = changes;
    const [service] = await tx
      .update(services)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning({ id: services.id });

    if (service) {
      await assignMembers(tx, service.id, { monitorIds, webhookIds });
    }

    return service;
  });

export const deleteService = async (id: string) => {
  const [service] = await db
    .delete(services)
    .where(eq(services.id, id))
    .returning({ id: services.id });
  return service;
};

export const findMembersByServiceIds = async (serviceIds: string[]) => {
  if (serviceIds.length === 0) {
    return { monitors: [], webhooks: [] };
  }

  const [monitorRows, webhookRows] = await Promise.all([
    db
      .select({
        id: monitors.id,
        serviceId: monitors.serviceId,
        name: monitors.name,
        status: monitors.status,
        isPaused: monitors.isPaused,
        uptimePercent: monitors.uptimePercent,
      })
      .from(monitors)
      .where(inArray(monitors.serviceId, serviceIds))
      .orderBy(asc(monitors.name)),
    db
      .select({
        id: webhooks.id,
        serviceId: webhooks.serviceId,
        name: webhooks.name,
        status: webhooks.status,
      })
      .from(webhooks)
      .where(inArray(webhooks.serviceId, serviceIds))
      .orderBy(asc(webhooks.name)),
  ]);

  return { monitors: monitorRows, webhooks: webhookRows };
};

const isActiveIncident = ne(incidents.status, "resolved");

export const findActiveIncidentSourceIds = async (sourceIds: string[]) => {
  if (sourceIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({ sourceId: incidents.sourceId })
    .from(incidents)
    .where(and(isActiveIncident, inArray(incidents.sourceId, sourceIds)));

  return rows.map((row) => row.sourceId);
};

export const listActiveIncidentsForSources = async (sourceIds: string[]) => {
  if (sourceIds.length === 0) {
    return [];
  }

  return db
    .select(incidentColumns)
    .from(incidents)
    .where(and(isActiveIncident, inArray(incidents.sourceId, sourceIds)))
    .orderBy(desc(incidents.startedAt));
};

export const findDailyCountsByServiceIds = async (
  serviceIds: string[],
  fromDay: string,
) => {
  if (serviceIds.length === 0) {
    return [];
  }

  return db
    .select({
      serviceId: monitors.serviceId,
      day: monitorDailyStats.day,
      checkCount: sql<number>`sum(${monitorDailyStats.checkCount})`.mapWith(
        Number,
      ),
      downCount: sql<number>`sum(${monitorDailyStats.downCount})`.mapWith(
        Number,
      ),
    })
    .from(monitorDailyStats)
    .innerJoin(monitors, eq(monitors.id, monitorDailyStats.monitorId))
    .where(
      and(
        inArray(monitors.serviceId, serviceIds),
        gte(monitorDailyStats.day, fromDay),
      ),
    )
    .groupBy(monitors.serviceId, monitorDailyStats.day);
};

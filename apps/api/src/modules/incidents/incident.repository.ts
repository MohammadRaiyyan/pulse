import {
  type IncidentActor,
  type IncidentResolutionReason,
  type IncidentSeverity,
  type IncidentSourceType,
  type IncidentStatus,
  type IncidentStatusFilter,
  type IncidentTransition,
  activeIncidentStatuses,
  incidentTransitionRules,
} from "@pulse/contracts";
import {
  type AnyColumn,
  type SQL,
  and,
  count,
  desc,
  eq,
  inArray,
  ne,
  sql,
} from "drizzle-orm";
import { db } from "../../db/client.ts";
import { incidents, monitors, webhooks } from "../../models/index.ts";

const actorColumn = (id: AnyColumn, name: AnyColumn) =>
  sql<IncidentActor | null>`case when ${id} is null then null else json_build_object('id', ${id}, 'name', ${name}) end`;

const incidentColumns = {
  id: incidents.id,
  source: {
    type: incidents.sourceType,
    id: incidents.sourceId,
    name: incidents.sourceName,
    isDeleted: sql<boolean>`${incidents.sourceDeletedAt} is not null`,
  },
  status: incidents.status,
  severity: incidents.severity,
  cause: incidents.cause,
  startedAt: incidents.startedAt,
  acknowledgedAt: incidents.acknowledgedAt,
  acknowledgedBy: actorColumn(
    incidents.acknowledgedById,
    incidents.acknowledgedByName,
  ),
  resolvedAt: incidents.resolvedAt,
  resolvedBy: actorColumn(incidents.resolvedById, incidents.resolvedByName),
  resolutionReason: incidents.resolutionReason,
};

export type IncidentRecord = {
  id: string;
  source: {
    type: IncidentSourceType;
    id: string;
    name: string;
    isDeleted: boolean;
  };
  status: IncidentStatus;
  severity: IncidentSeverity;
  cause: string;
  startedAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: IncidentActor | null;
  resolvedAt: Date | null;
  resolvedBy: IncidentActor | null;
  resolutionReason: IncidentResolutionReason | null;
};

type NewIncident = {
  sourceType: IncidentSourceType;
  sourceId: string;
  sourceName: string;
  severity: IncidentSeverity;
  cause: string;
};

const isActive = ne(incidents.status, "resolved");

const statusFilter = (filter: IncidentStatusFilter | undefined) => {
  if (filter === undefined) {
    return undefined;
  }

  if (filter === "active") {
    return inArray(incidents.status, [...activeIncidentStatuses]);
  }

  return eq(incidents.status, filter);
};

export const listIncidents = async (
  status: IncidentStatusFilter | undefined,
  limit: number,
  offset: number,
) => {
  const where = statusFilter(status);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(incidentColumns)
      .from(incidents)
      .where(where)
      .orderBy(desc(incidents.startedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(incidents).where(where),
  ]);

  return { rows, total: totalRow?.total ?? 0 };
};

export const findIncident = async (
  id: string,
): Promise<IncidentRecord | undefined> => {
  const [incident] = await db
    .select(incidentColumns)
    .from(incidents)
    .where(eq(incidents.id, id));
  return incident;
};

const watchedSource = (
  sourceType: IncidentSourceType,
  sourceId: string,
): { table: typeof monitors | typeof webhooks; where: SQL | undefined } =>
  sourceType === "monitor"
    ? {
        table: monitors,
        where: and(eq(monitors.id, sourceId), eq(monitors.isPaused, false)),
      }
    : { table: webhooks, where: eq(webhooks.id, sourceId) };

export const insertIncidentIfNoneActive = (values: NewIncident) =>
  db.transaction(async (tx) => {
    const source = watchedSource(values.sourceType, values.sourceId);
    const [watched] = await tx
      .select({ id: source.table.id })
      .from(source.table)
      .where(source.where)
      .for("share");

    if (!watched) {
      return undefined;
    }

    const [incident] = await tx
      .insert(incidents)
      .values(values)
      .onConflictDoNothing({
        target: incidents.sourceId,
        where: sql`${incidents.status} <> 'resolved'`,
      })
      .returning({ id: incidents.id });

    return incident;
  });

export const escalateActiveIncident = async (
  sourceId: string,
  cause: string,
) => {
  const [incident] = await db
    .update(incidents)
    .set({ severity: "critical", cause })
    .where(
      and(
        eq(incidents.sourceId, sourceId),
        isActive,
        eq(incidents.severity, "warning"),
      ),
    )
    .returning({ id: incidents.id });

  return incident;
};

export const applyTransition = async (
  id: string,
  transition: IncidentTransition,
  actor: IncidentActor,
) => {
  const rule = incidentTransitionRules[transition];
  const resolvedBy =
    transition === "resolve"
      ? { resolvedAt: sql`now()`, resolvedById: actor.id, resolvedByName: actor.name }
      : {};

  const [incident] = await db
    .update(incidents)
    .set({
      status: rule.to,
      acknowledgedAt: sql`coalesce(${incidents.acknowledgedAt}, now())`,
      acknowledgedById: sql`coalesce(${incidents.acknowledgedById}, ${actor.id})`,
      acknowledgedByName: sql`coalesce(${incidents.acknowledgedByName}, ${actor.name})`,
      ...resolvedBy,
    })
    .where(and(eq(incidents.id, id), inArray(incidents.status, [...rule.from])))
    .returning(incidentColumns);

  return incident;
};

export const resolveActiveIncident = async (
  sourceId: string,
  reason: IncidentResolutionReason,
) => {
  const [incident] = await db
    .update(incidents)
    .set({
      status: "resolved",
      resolvedAt: sql`now()`,
      resolutionReason: reason,
    })
    .where(and(eq(incidents.sourceId, sourceId), isActive))
    .returning(incidentColumns);

  return incident;
};

export const closeIncidentsForDeletedSource = (sourceId: string) =>
  db.transaction(async (tx) => {
    const [resolved] = await tx
      .update(incidents)
      .set({
        status: "resolved",
        resolvedAt: sql`now()`,
        resolutionReason: "source_deleted",
      })
      .where(and(eq(incidents.sourceId, sourceId), isActive))
      .returning(incidentColumns);

    await tx
      .update(incidents)
      .set({ sourceDeletedAt: sql`now()` })
      .where(eq(incidents.sourceId, sourceId));

    return resolved;
  });

export const renameIncidentsForSource = async (
  sourceId: string,
  sourceName: string,
) => {
  await db
    .update(incidents)
    .set({ sourceName })
    .where(eq(incidents.sourceId, sourceId));
};

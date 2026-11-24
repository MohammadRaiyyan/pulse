import {
  type IncidentSourceType,
  type IncidentStatus,
  type IncidentTransition,
  incidentTransitionRules,
} from "@pulse/contracts";
import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { isUniqueViolation } from "../../lib/database-errors.ts";
import { incidents } from "../../models/index.ts";

const incidentColumns = {
  id: incidents.id,
  source: {
    type: incidents.sourceType,
    id: incidents.sourceId,
    name: incidents.sourceName,
  },
  status: incidents.status,
  cause: incidents.cause,
  startedAt: incidents.startedAt,
  acknowledgedAt: incidents.acknowledgedAt,
  resolvedAt: incidents.resolvedAt,
};

export type IncidentRecord = {
  id: string;
  source: { type: IncidentSourceType; id: string; name: string };
  status: IncidentStatus;
  cause: string;
  startedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
};

type NewIncident = {
  sourceType: IncidentSourceType;
  sourceId: string;
  sourceName: string;
  cause: string;
};

export const listIncidents = async (
  status: IncidentStatus | undefined,
  limit: number,
  offset: number,
) => {
  const where = status ? eq(incidents.status, status) : undefined;

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

export const insertIncidentIfNoneActive = async (values: NewIncident) => {
  try {
    const [incident] = await db
      .insert(incidents)
      .values(values)
      .returning({ id: incidents.id });
    return incident;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return undefined;
    }

    throw error;
  }
};

export const applyTransition = async (
  id: string,
  transition: IncidentTransition,
) => {
  const rule = incidentTransitionRules[transition];

  const [incident] = await db
    .update(incidents)
    .set({
      status: rule.to,
      acknowledgedAt: sql`coalesce(${incidents.acknowledgedAt}, now())`,
      resolvedAt: transition === "resolve" ? sql`now()` : undefined,
    })
    .where(and(eq(incidents.id, id), inArray(incidents.status, [...rule.from])))
    .returning(incidentColumns);

  return incident;
};

export const resolveActiveIncident = async (sourceId: string) => {
  const [incident] = await db
    .update(incidents)
    .set({
      status: "resolved",
      acknowledgedAt: sql`coalesce(${incidents.acknowledgedAt}, now())`,
      resolvedAt: sql`now()`,
    })
    .where(
      and(eq(incidents.sourceId, sourceId), ne(incidents.status, "resolved")),
    )
    .returning(incidentColumns);

  return incident;
};

export const renameIncidentsForSource = async (
  sourceId: string,
  sourceName: string,
) => {
  await db
    .update(incidents)
    .set({ sourceName })
    .where(eq(incidents.sourceId, sourceId));
};

export const deleteIncidentsForSource = async (sourceId: string) => {
  await db.delete(incidents).where(eq(incidents.sourceId, sourceId));
};

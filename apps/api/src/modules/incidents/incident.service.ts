import type {
  IncidentListQuery,
  IncidentSourceType,
  IncidentTransition,
} from "@pulse/contracts";
import { enqueueAlert } from "../../jobs/queues.ts";
import { cacheKeys, invalidate } from "../../lib/cache.ts";
import { conflict, notFound } from "../../lib/errors.ts";
import { logger } from "../../lib/logger.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import {
  applyTransition,
  deleteIncidentsForSource,
  findIncident,
  insertIncidentIfNoneActive,
  listIncidents,
  renameIncidentsForSource,
  resolveActiveIncident,
} from "./incident.repository.ts";

const LABEL = "Incident";

export type IncidentSource = {
  type: IncidentSourceType;
  id: string;
  name: string;
  alertChannelIds: string[];
};

const notifyChannels = async (
  channelIds: string[],
  event: "incident.opened" | "incident.resolved",
  incidentId: string,
) => {
  for (const channelId of channelIds) {
    await enqueueAlert({ channelId, event, incidentId });
  }
};

export const getIncidents = async (query: IncidentListQuery) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listIncidents(query.status, limit, offset);
  return toPage(rows, total, query);
};

export const getIncident = async (id: string) => {
  const incident = await findIncident(id);

  if (!incident) {
    throw notFound(LABEL);
  }

  return incident;
};

export const transitionIncident = async (
  id: string,
  transition: IncidentTransition,
) => {
  const updated = await applyTransition(id, transition);

  if (!updated) {
    const current = await getIncident(id);
    throw conflict(
      `Cannot ${transition} an incident that is ${current.status}`,
    );
  }

  await invalidate(cacheKeys.dashboardSummary);

  return updated;
};

export const openIncidentForSource = async (
  source: IncidentSource,
  cause: string,
) => {
  const incident = await insertIncidentIfNoneActive({
    sourceType: source.type,
    sourceId: source.id,
    sourceName: source.name,
    cause,
  });

  if (!incident) {
    return;
  }

  logger.info(
    { incidentId: incident.id, source: source.name, cause },
    "Incident opened",
  );
  await invalidate(cacheKeys.dashboardSummary);
  await notifyChannels(source.alertChannelIds, "incident.opened", incident.id);
};

export const resolveIncidentForSource = async (source: IncidentSource) => {
  const incident = await resolveActiveIncident(source.id);

  if (!incident) {
    return;
  }

  logger.info(
    { incidentId: incident.id, source: source.name },
    "Incident resolved",
  );
  await invalidate(cacheKeys.dashboardSummary);
  await notifyChannels(
    source.alertChannelIds,
    "incident.resolved",
    incident.id,
  );
};

export const renameIncidentSource = (sourceId: string, name: string) =>
  renameIncidentsForSource(sourceId, name);

export const removeIncidentsForSource = async (sourceId: string) => {
  await deleteIncidentsForSource(sourceId);
  await invalidate(cacheKeys.dashboardSummary);
};

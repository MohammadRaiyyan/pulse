import type {
  CreateMonitorInput,
  MonitorListQuery,
  PaginationQuery,
  UpdateMonitorInput,
} from "@pulse/contracts";
import { cacheKeys, invalidate } from "../../lib/cache.ts";
import { notFound } from "../../lib/errors.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import {
  removeIncidentsForSource,
  renameIncidentSource,
} from "../incidents/incident.service.ts";
import {
  deleteMonitor,
  findChannelIdsByMonitorIds,
  findChannelIdsForMonitor,
  findMonitor,
  insertMonitor,
  listChecks,
  listMonitors,
  updateMonitor,
} from "./monitor.repository.ts";

const LABEL = "Monitor";

export const getMonitors = async (query: MonitorListQuery) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listMonitors(query, limit, offset);
  const channelIds = await findChannelIdsByMonitorIds(
    rows.map((row) => row.id),
  );

  const items = rows.map((monitor) => ({
    ...monitor,
    alertChannelIds: channelIds.get(monitor.id) ?? [],
  }));

  return toPage(items, total, query);
};

export const getMonitor = async (id: string) => {
  const [monitor, alertChannelIds] = await Promise.all([
    findMonitor(id),
    findChannelIdsForMonitor(id),
  ]);

  if (!monitor) {
    throw notFound(LABEL);
  }

  return { ...monitor, alertChannelIds };
};

export const createMonitor = async (input: CreateMonitorInput) => {
  const monitor = await insertMonitor(input);
  await invalidate(cacheKeys.dashboardSummary);

  return { ...monitor, alertChannelIds: input.alertChannelIds };
};

export const updateMonitorById = async (
  id: string,
  input: UpdateMonitorInput,
) => {
  const monitor = await updateMonitor(id, input);

  if (!monitor) {
    throw notFound(LABEL);
  }

  if (input.name) {
    await renameIncidentSource(id, input.name);
  }

  await invalidate(cacheKeys.dashboardSummary);

  const alertChannelIds =
    input.alertChannelIds ?? (await findChannelIdsForMonitor(id));

  return { ...monitor, alertChannelIds };
};

export const removeMonitor = async (id: string) => {
  const monitor = await deleteMonitor(id);

  if (!monitor) {
    throw notFound(LABEL);
  }

  await removeIncidentsForSource(id);
};

export const getMonitorChecks = async (
  monitorId: string,
  query: PaginationQuery,
) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listChecks(monitorId, limit, offset);
  return toPage(rows, total, query);
};

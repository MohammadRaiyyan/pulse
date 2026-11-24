import type {
  CreateMonitorInput,
  MonitorListQuery,
  PaginationQuery,
  UpdateMonitorInput,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { cacheKeys, invalidate } from "../../lib/cache.ts";
import { conflict, notFound } from "../../lib/errors.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import { publishChange } from "../../lib/realtime.ts";
import {
  closeIncidentsForSource,
  renameIncidentSource,
  resolveIncidentForSource,
} from "../incidents/incident.service.ts";
import {
  countMonitors,
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
  if ((await countMonitors()) >= env.MAX_MONITORS_PER_WORKSPACE) {
    throw conflict(
      `Monitor limit reached. This workspace can have up to ${env.MAX_MONITORS_PER_WORKSPACE} monitors.`,
    );
  }

  const monitor = await insertMonitor(input);
  await invalidate(cacheKeys.dashboardSummary);
  publishChange({ type: "monitor.updated", id: monitor.id });

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

  const alertChannelIds =
    input.alertChannelIds ?? (await findChannelIdsForMonitor(id));
  publishChange({ type: "monitor.updated", id });

  if (input.isPaused) {
    await resolveIncidentForSource(
      { type: "monitor", id, name: monitor.name, alertChannelIds },
      "monitor_paused",
    );
  }

  await invalidate(cacheKeys.dashboardSummary);

  return { ...monitor, alertChannelIds };
};

export const removeMonitor = async (id: string) => {
  const monitor = await deleteMonitor(id);

  if (!monitor) {
    throw notFound(LABEL);
  }

  await closeIncidentsForSource(id);
  publishChange({ type: "monitor.deleted", id });
};

export const getMonitorChecks = async (
  monitorId: string,
  query: PaginationQuery,
) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listChecks(monitorId, limit, offset);
  return toPage(rows, total, query);
};

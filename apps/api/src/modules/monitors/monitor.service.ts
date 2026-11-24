import type {
  CreateMonitorInput,
  MonitorListQuery,
  PaginationQuery,
  UpdateMonitorInput,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import { invalidate, statusCacheKeys } from "../../lib/cache.ts";
import { conflict, notFound } from "../../lib/errors.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import { publishChange } from "../../lib/realtime.ts";
import {
  closeIncidentsForSource,
  renameIncidentSource,
  resolveIncidentForSource,
} from "../incidents/incident.service.ts";
import type { MonitorRow } from "../../models/index.ts";
import {
  deleteMonitor,
  findChannelIdsByMonitorIds,
  findChannelIdsForMonitor,
  findMonitor,
  findMonitorRequestConfig,
  insertMonitorWithinLimit,
  listChecks,
  listMonitors,
  updateMonitor,
} from "./monitor.repository.ts";
import {
  resolveRequestConfig,
  toPublicHeaders,
  touchesRequestConfig,
} from "./request-config.ts";

const LABEL = "Monitor";

const withPublicFields = (monitor: MonitorRow, alertChannelIds: string[]) => ({
  ...monitor,
  requestHeaders: toPublicHeaders(monitor.requestHeaders),
  alertChannelIds,
});

export const getMonitors = async (query: MonitorListQuery) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listMonitors(query, limit, offset);
  const channelIds = await findChannelIdsByMonitorIds(
    rows.map((row) => row.id),
  );

  const items = rows.map((monitor) =>
    withPublicFields(monitor, channelIds.get(monitor.id) ?? []),
  );

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

  return withPublicFields(monitor, alertChannelIds);
};

export const createMonitor = async (input: CreateMonitorInput) => {
  const { requestHeaders = [], ...fields } = input;
  const request = resolveRequestConfig({ ...fields, requestHeaders }, undefined);
  const monitor = await insertMonitorWithinLimit(
    { ...fields, ...request },
    env.MAX_MONITORS_PER_WORKSPACE,
  );

  if (!monitor) {
    throw conflict(
      `Monitor limit reached. This workspace can have up to ${env.MAX_MONITORS_PER_WORKSPACE} monitors.`,
    );
  }

  await invalidate(...statusCacheKeys);
  publishChange({ type: "monitor.updated", id: monitor.id });

  return withPublicFields(monitor, input.alertChannelIds);
};

const findExistingRequestConfig = async (id: string) => {
  const config = await findMonitorRequestConfig(id);

  if (!config) {
    throw notFound(LABEL);
  }

  return config;
};

export const updateMonitorById = async (
  id: string,
  input: UpdateMonitorInput,
) => {
  const { requestHeaders, ...fields } = input;
  const request = touchesRequestConfig(input)
    ? resolveRequestConfig(
        { ...fields, requestHeaders },
        await findExistingRequestConfig(id),
      )
    : {};
  const monitor = await updateMonitor(id, { ...fields, ...request });

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

  await invalidate(...statusCacheKeys);

  return withPublicFields(monitor, alertChannelIds);
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

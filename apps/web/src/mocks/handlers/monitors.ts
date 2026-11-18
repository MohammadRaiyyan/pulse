import {
  type CreateMonitorInput,
  type Monitor,
  type MonitorListQuery,
  type UpdateMonitorInput,
  endpoints,
  resources,
} from "@pulse/contracts";
import { db } from "../db";
import { childListHandler } from "../lib/child-list";
import { matchesStatus } from "../lib/collection";
import { crudHandlers } from "../lib/crud";
import { newId } from "../lib/ids";
import {
  assertChannelsExist,
  channelLinkedSourceHooks,
} from "../lib/relations";
import { now } from "../lib/time";

const LABEL = "Monitor";

const toMonitor = (input: CreateMonitorInput): Monitor => {
  assertChannelsExist(input.alertChannelIds);

  return {
    ...input,
    id: newId(),
    status: "pending",
    isPaused: false,
    lastCheckedAt: null,
    lastResponseTimeMs: null,
    uptimePercent: null,
    createdAt: now(),
    updatedAt: now(),
  };
};

const applyMonitorUpdate = (
  monitor: Monitor,
  input: UpdateMonitorInput,
): Monitor => {
  assertChannelsExist(input.alertChannelIds);

  return { ...monitor, ...input, updatedAt: now() };
};

const matchesSearch = (monitor: Monitor, search = "") =>
  [monitor.name, monitor.url].some((value) =>
    value.toLowerCase().includes(search.toLowerCase()),
  );

const matchesMonitor = (monitor: Monitor, query: MonitorListQuery) =>
  matchesStatus(monitor, query) && matchesSearch(monitor, query.search);

export const monitorHandlers = [
  ...crudHandlers(resources.monitors, {
    label: LABEL,
    store: db.monitors,
    sortKey: (monitor) => monitor.createdAt,
    matches: matchesMonitor,
    toItem: toMonitor,
    applyUpdate: applyMonitorUpdate,
    ...channelLinkedSourceHooks((monitor) => db.checks.delete(monitor.id)),
  }),
  childListHandler(endpoints.listMonitorChecks, {
    label: LABEL,
    parents: db.monitors,
    children: db.checks,
    sortKey: (check) => check.checkedAt,
  }),
];

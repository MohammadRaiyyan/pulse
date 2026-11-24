import type {
  CreateServiceInput,
  PaginationQuery,
  UpdateServiceInput,
} from "@pulse/contracts";
import { cacheKeys, invalidate } from "../../lib/cache.ts";
import { notFound } from "../../lib/errors.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import { publishChange } from "../../lib/realtime.ts";
import {
  buildUptimeHistory,
  deriveServiceStatus,
  historyStartDay,
  webhookDailyCounts,
} from "./service-health.ts";
import {
  deleteService,
  findActiveIncidentSourceIds,
  findDailyCountsByServiceIds,
  findMembersByServiceIds,
  findService,
  findWebhookOutages,
  insertService,
  listActiveIncidentsForSources,
  listServices,
  updateService,
} from "./service.repository.ts";

const LABEL = "Service";

type ServiceRecord = NonNullable<Awaited<ReturnType<typeof findService>>>;

type Members = Awaited<ReturnType<typeof findMembersByServiceIds>>;

export const toMemberStates = (
  monitors: Members["monitors"],
  webhooks: Members["webhooks"],
) => [
  ...monitors.map((monitor) => ({
    status: monitor.status,
    isPaused: monitor.isPaused,
  })),
  ...webhooks.map((webhook) => ({ status: webhook.status, isPaused: false })),
];

export const loadMemberHealth = async (serviceIds: string[]) => {
  const members = await findMembersByServiceIds(serviceIds);
  const monitorsByService = Map.groupBy(
    members.monitors,
    (monitor) => monitor.serviceId,
  );
  const webhooksByService = Map.groupBy(
    members.webhooks,
    (webhook) => webhook.serviceId,
  );

  return {
    monitorsOf: (serviceId: string) => monitorsByService.get(serviceId) ?? [],
    webhooksOf: (serviceId: string) => webhooksByService.get(serviceId) ?? [],
    memberIds: [...members.monitors, ...members.webhooks].map(
      (member) => member.id,
    ),
  };
};

const withHealth = async (rows: ServiceRecord[]) => {
  const health = await loadMemberHealth(rows.map((row) => row.id));
  const activeSourceIds = new Set(
    await findActiveIncidentSourceIds(health.memberIds),
  );

  return rows.map((row) => {
    const monitors = health.monitorsOf(row.id);
    const webhooks = health.webhooksOf(row.id);
    const monitorIds = monitors.map((monitor) => monitor.id);
    const webhookIds = webhooks.map((webhook) => webhook.id);

    return {
      ...row,
      monitorIds,
      webhookIds,
      status: deriveServiceStatus(toMemberStates(monitors, webhooks)),
      activeIncidentCount: [...monitorIds, ...webhookIds].filter((id) =>
        activeSourceIds.has(id),
      ).length,
    };
  });
};

export const getServices = async (query: PaginationQuery) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listServices(limit, offset);

  return toPage(await withHealth(rows), total, query);
};

export const getService = async (id: string) => {
  const service = await findService(id);

  if (!service) {
    throw notFound(LABEL);
  }

  const [withStatus] = await withHealth([service]);

  return withStatus;
};

const announceChange = async (
  type: "service.updated" | "service.deleted",
  id: string,
) => {
  await invalidate(cacheKeys.publicStatus);
  publishChange({ type, id });
};

export const createService = async (input: CreateServiceInput) => {
  const { monitorIds, webhookIds, ...values } = input;
  const service = await insertService(values, { monitorIds, webhookIds });

  await announceChange("service.updated", service.id);

  return getService(service.id);
};

export const updateServiceById = async (
  id: string,
  input: UpdateServiceInput,
) => {
  const service = await updateService(id, input);

  if (!service) {
    throw notFound(LABEL);
  }

  await announceChange("service.updated", id);

  return getService(id);
};

export const removeService = async (id: string) => {
  const service = await deleteService(id);

  if (!service) {
    throw notFound(LABEL);
  }

  await announceChange("service.deleted", id);
};

export const getServiceOverview = async (id: string) => {
  const service = await findService(id);

  if (!service) {
    throw notFound(LABEL);
  }

  const now = new Date();
  const fromDay = historyStartDay(now);
  const [members, dailyCounts] = await Promise.all([
    findMembersByServiceIds([id]),
    findDailyCountsByServiceIds([id], fromDay),
  ]);
  const outages = await findWebhookOutages(
    members.webhooks.map((webhook) => webhook.id),
    fromDay,
  );
  const activeIncidents = await listActiveIncidentsForSources([
    ...members.monitors.map((monitor) => monitor.id),
    ...members.webhooks.map((webhook) => webhook.id),
  ]);

  return {
    monitors: members.monitors.map((monitor) => ({
      id: monitor.id,
      name: monitor.name,
      status: monitor.status,
      isPaused: monitor.isPaused,
      uptimePercent: monitor.uptimePercent,
    })),
    webhooks: members.webhooks.map((webhook) => ({
      id: webhook.id,
      name: webhook.name,
      status: webhook.status,
    })),
    activeIncidents,
    uptime: buildUptimeHistory(
      members.monitors.length > 0
        ? dailyCounts
        : webhookDailyCounts(members.webhooks, outages, now),
      now,
    ),
  };
};

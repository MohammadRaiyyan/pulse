import {
  type IncidentStatus,
  PUBLIC_RECENT_INCIDENT_DAYS,
  type PublicIncidentState,
  type StatusPageSettings,
  type UpdateStatusPageSettingsInput,
} from "@pulse/contracts";
import { cacheKeys, cached, invalidate } from "../../lib/cache.ts";
import { daysAgo } from "../../lib/dates.ts";
import { notFound } from "../../lib/errors.ts";
import {
  buildUptimeHistory,
  deriveOverallStatus,
  deriveServiceStatus,
  historyStartDay,
} from "../services/service-health.ts";
import {
  findDailyCountsByServiceIds,
  listPublicServices,
} from "../services/service.repository.ts";
import {
  loadMemberHealth,
  toMemberStates,
} from "../services/service.service.ts";
import {
  findStatusPageSettings,
  listPublicIncidentsForSources,
  saveStatusPageSettings,
} from "./status-page.repository.ts";

const PUBLIC_STATUS_CACHE_SECONDS = 30;

const defaultSettings: StatusPageSettings = {
  isEnabled: false,
  title: "Status",
  description: "",
};

const publicIncidentState: Record<IncidentStatus, PublicIncidentState> = {
  open: "investigating",
  acknowledged: "identified",
  resolved: "resolved",
};

export const getStatusPageSettings = async () =>
  (await findStatusPageSettings()) ?? defaultSettings;

export const updateStatusPageSettings = async (
  input: UpdateStatusPageSettingsInput,
) => {
  const settings = await saveStatusPageSettings(input);

  await invalidate(cacheKeys.publicStatus);

  return settings;
};

const newestResolvedFirst = (
  left: { resolvedAt: Date | null },
  right: { resolvedAt: Date | null },
) => (right.resolvedAt?.getTime() ?? 0) - (left.resolvedAt?.getTime() ?? 0);

const buildPublicStatus = async () => {
  const settings = await getStatusPageSettings();

  if (!settings.isEnabled) {
    return null;
  }

  const now = new Date();
  const publicServices = await listPublicServices();
  const serviceIds = publicServices.map((service) => service.id);
  const [health, dailyCounts] = await Promise.all([
    loadMemberHealth(serviceIds),
    findDailyCountsByServiceIds(serviceIds, historyStartDay(now)),
  ]);
  const countsByService = Map.groupBy(dailyCounts, (row) => row.serviceId);
  const serviceByMember = new Map(
    publicServices.flatMap((service) =>
      [...health.monitorsOf(service.id), ...health.webhooksOf(service.id)].map(
        (member) => [member.id, service] as const,
      ),
    ),
  );

  const services = publicServices.map((service) => ({
    ...service,
    status: deriveServiceStatus(
      toMemberStates(health.monitorsOf(service.id), health.webhooksOf(service.id)),
    ),
    ...buildUptimeHistory(countsByService.get(service.id) ?? [], now),
  }));

  const incidents = (
    await listPublicIncidentsForSources(
      health.memberIds,
      daysAgo(PUBLIC_RECENT_INCIDENT_DAYS),
    )
  ).flatMap((incident) => {
    const service = serviceByMember.get(incident.sourceId);

    return service
      ? [
          {
            id: incident.id,
            serviceId: service.id,
            serviceName: service.name,
            severity: incident.severity,
            state: publicIncidentState[incident.status],
            startedAt: incident.startedAt,
            resolvedAt: incident.resolvedAt,
          },
        ]
      : [];
  });

  return {
    title: settings.title,
    description: settings.description,
    overallStatus: deriveOverallStatus(services.map((service) => service.status)),
    services,
    activeIncidents: incidents.filter(
      (incident) => incident.state !== "resolved",
    ),
    recentIncidents: incidents
      .filter((incident) => incident.state === "resolved")
      .toSorted(newestResolvedFirst),
    generatedAt: now,
  };
};

export const getPublicStatus = async () => {
  const status = await cached(
    cacheKeys.publicStatus,
    PUBLIC_STATUS_CACHE_SECONDS,
    buildPublicStatus,
  );

  if (!status) {
    throw notFound("Status page");
  }

  return status;
};

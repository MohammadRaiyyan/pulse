import {
  type CreateServiceInput,
  type Incident,
  type OverallStatus,
  type PublicIncidentState,
  type Service,
  type ServiceStatus,
  type StatusPageSettings,
  UPTIME_HISTORY_DAYS,
  type UpdateServiceInput,
  endpoints,
  isActiveIncidentStatus,
  resources,
} from "@pulse/contracts";
import { db } from "../db";
import { findById } from "../lib/collection";
import { crudHandlers } from "../lib/crud";
import { newId } from "../lib/ids";
import { errorResponse, notFound } from "../lib/responses";
import { route } from "../lib/route";
import { now } from "../lib/time";

const LABEL = "Service";
const DAY_MS = 86_400_000;

const services = new Map<string, Service>();

let statusPageSettings: StatusPageSettings = {
  isEnabled: false,
  title: "Status",
  description: "",
};

const severityRank: Record<ServiceStatus, number> = {
  no_data: 0,
  up: 1,
  pending: 2,
  degraded: 3,
  down: 4,
};

const memberStatus: Record<string, ServiceStatus> = {
  up: "up",
  active: "up",
  pending: "pending",
  degraded: "degraded",
  silent: "degraded",
  down: "down",
};

const membersOf = (serviceId: string) => ({
  monitors: [...db.monitors.values()].filter(
    (monitor) => monitor.serviceId === serviceId,
  ),
  webhooks: [...db.webhooks.values()].filter(
    (webhook) => webhook.serviceId === serviceId,
  ),
});

const memberIdsOf = (serviceId: string) => {
  const { monitors, webhooks } = membersOf(serviceId);
  return [...monitors, ...webhooks].map((member) => member.id);
};

const statusOf = (serviceId: string) => {
  const { monitors, webhooks } = membersOf(serviceId);

  return [
    ...monitors.filter((monitor) => !monitor.isPaused),
    ...webhooks,
  ].reduce<ServiceStatus>((worst, member) => {
    const status = memberStatus[member.status] ?? "pending";
    return severityRank[status] > severityRank[worst] ? status : worst;
  }, "no_data");
};

const incidentsOf = (serviceId: string) => {
  const memberIds = new Set(memberIdsOf(serviceId));
  return [...db.incidents.values()].filter((incident) =>
    memberIds.has(incident.source.id),
  );
};

const activeIncidentsOf = (serviceId: string) =>
  incidentsOf(serviceId).filter((incident) =>
    isActiveIncidentStatus(incident.status),
  );

const present = (service: Service): Service => {
  const { monitors, webhooks } = membersOf(service.id);

  return {
    ...service,
    monitorIds: monitors.map((monitor) => monitor.id),
    webhookIds: webhooks.map((webhook) => webhook.id),
    status: statusOf(service.id),
    activeIncidentCount: activeIncidentsOf(service.id).length,
  };
};

const assertUniqueName = (name: string, id?: string) => {
  const taken = [...services.values()].some(
    (service) =>
      service.id !== id && service.name.toLowerCase() === name.toLowerCase(),
  );

  if (taken) {
    throw errorResponse("CONFLICT", "Service name already in use", {
      fieldErrors: { name: ["A service with this name already exists"] },
    });
  }
};

const nextServiceId = (
  member: { id: string; serviceId: string | null },
  serviceId: string,
  memberIds: readonly string[],
) => {
  if (memberIds.includes(member.id)) {
    return serviceId;
  }

  return member.serviceId === serviceId ? null : member.serviceId;
};

const assignMembers = (
  serviceId: string,
  { monitorIds, webhookIds }: UpdateServiceInput,
) => {
  if (monitorIds) {
    db.monitors.forEach((monitor) => {
      db.monitors.set(monitor.id, {
        ...monitor,
        serviceId: nextServiceId(monitor, serviceId, monitorIds),
      });
    });
  }

  if (webhookIds) {
    db.webhooks.forEach((webhook) => {
      db.webhooks.set(webhook.id, {
        ...webhook,
        serviceId: nextServiceId(webhook, serviceId, webhookIds),
      });
    });
  }
};

const toService = (input: CreateServiceInput): Service => {
  assertUniqueName(input.name);
  const id = newId();
  assignMembers(id, input);

  return {
    ...input,
    id,
    status: "no_data",
    activeIncidentCount: 0,
    createdAt: now(),
    updatedAt: now(),
  };
};

const applyServiceUpdate = (
  service: Service,
  input: UpdateServiceInput,
): Service => {
  if (input.name) {
    assertUniqueName(input.name, service.id);
  }

  assignMembers(service.id, input);

  return { ...service, ...input, updatedAt: now() };
};

const emptyHistory = () => ({
  uptimePercent: null,
  days: Array.from({ length: UPTIME_HISTORY_DAYS }, (_, index) => ({
    date: new Date(Date.now() - (UPTIME_HISTORY_DAYS - 1 - index) * DAY_MS)
      .toISOString()
      .slice(0, 10),
    uptimePercent: null,
  })),
});

const publicState: Record<Incident["status"], PublicIncidentState> = {
  open: "investigating",
  acknowledged: "identified",
  resolved: "resolved",
};

const overallStatusOf = (statuses: readonly ServiceStatus[]): OverallStatus => {
  const reporting = statuses.filter((status) => status !== "no_data");
  const downCount = reporting.filter((status) => status === "down").length;

  if (downCount > 0) {
    return downCount === reporting.length ? "major_outage" : "partial_outage";
  }

  return reporting.includes("degraded") ? "degraded" : "operational";
};

const buildPublicStatus = () => {
  const publicServices = [...services.values()]
    .filter((service) => service.isPublic)
    .toSorted((left, right) => left.position - right.position)
    .map(present);
  const incidents = publicServices.flatMap((service) =>
    incidentsOf(service.id).map((incident) => ({
      id: incident.id,
      serviceId: service.id,
      serviceName: service.name,
      severity: incident.severity,
      state: publicState[incident.status],
      startedAt: incident.startedAt,
      resolvedAt: incident.resolvedAt,
    })),
  );

  return {
    title: statusPageSettings.title,
    description: statusPageSettings.description,
    overallStatus: overallStatusOf(
      publicServices.map((service) => service.status),
    ),
    services: publicServices.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      status: service.status,
      ...emptyHistory(),
    })),
    activeIncidents: incidents.filter(
      (incident) => incident.state !== "resolved",
    ),
    recentIncidents: incidents.filter(
      (incident) => incident.state === "resolved",
    ),
    generatedAt: now(),
  };
};

export const serviceHandlers = [
  ...crudHandlers(resources.services, {
    label: LABEL,
    store: services,
    sortKey: (service) => service.createdAt,
    present,
    toItem: toService,
    applyUpdate: applyServiceUpdate,
    onDelete: (service) => assignMembers(service.id, { monitorIds: [], webhookIds: [] }),
  }),
  route(endpoints.getServiceOverview, ({ params, respond }) => {
    const service = findById(services, params, LABEL);
    const { monitors, webhooks } = membersOf(service.id);

    return respond({
      monitors: monitors.map(({ id, name, status, isPaused, uptimePercent }) => ({
        id,
        name,
        status,
        isPaused,
        uptimePercent,
      })),
      webhooks: webhooks.map(({ id, name, status }) => ({ id, name, status })),
      activeIncidents: activeIncidentsOf(service.id),
      uptime: emptyHistory(),
    });
  }),
  route(endpoints.getStatusPageSettings, ({ respond }) =>
    respond(statusPageSettings),
  ),
  route(endpoints.updateStatusPageSettings, ({ body, respond }) => {
    statusPageSettings = { ...statusPageSettings, ...body };
    return respond(statusPageSettings);
  }),
  route(endpoints.getPublicStatus, ({ respond }) =>
    statusPageSettings.isEnabled
      ? respond(buildPublicStatus())
      : notFound("Status page"),
  ),
];

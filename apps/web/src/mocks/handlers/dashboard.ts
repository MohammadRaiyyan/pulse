import {
  endpoints,
  isActiveIncidentStatus,
  monitorStatusSchema,
  webhookStatusSchema,
} from "@pulse/contracts";
import { db } from "../db";
import { route } from "../lib/route";
import { tallyByOption } from "../lib/tally";

const average = (values: readonly number[]) =>
  values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const presentValues = (values: ReadonlyArray<number | null>) =>
  values.filter((value): value is number => value !== null);

const roundOrNull = (value: number | null) =>
  value === null ? null : Math.round(value);

const buildSummary = () => {
  const monitors = [...db.monitors.values()];
  const activeMonitors = monitors.filter((monitor) => !monitor.isPaused);
  const webhooks = [...db.webhooks.values()];
  const activeIncidents = [...db.incidents.values()].filter((incident) =>
    isActiveIncidentStatus(incident.status),
  );

  return {
    monitors: {
      total: monitors.length,
      paused: monitors.length - activeMonitors.length,
      byStatus: tallyByOption(
        monitorStatusSchema,
        monitors.map((monitor) => monitor.status),
      ),
    },
    webhooks: {
      total: webhooks.length,
      byStatus: tallyByOption(
        webhookStatusSchema,
        webhooks.map((webhook) => webhook.status),
      ),
    },
    openIncidents: activeIncidents.filter(
      (incident) => incident.status === "open",
    ).length,
    activeIncidents: activeIncidents.length,
    criticalIncidents: activeIncidents.filter(
      (incident) => incident.severity === "critical",
    ).length,
    averageResponseTimeMs: roundOrNull(
      average(
        presentValues(
          activeMonitors.map((monitor) => monitor.lastResponseTimeMs),
        ),
      ),
    ),
    uptimePercent: average(
      presentValues(activeMonitors.map((monitor) => monitor.uptimePercent)),
    ),
  };
};

export const dashboardHandlers = [
  route(endpoints.dashboardSummary, ({ respond }) => respond(buildSummary())),
];

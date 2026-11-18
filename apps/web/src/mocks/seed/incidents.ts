import type {
  Incident,
  IncidentSource,
  IncidentSourceType,
  Monitor,
  Webhook,
} from "@pulse/contracts";
import { seedId } from "../lib/ids";
import { minutesAgo } from "../lib/time";

const INCIDENT_NAMESPACE = 20;

const sourceOf = (
  type: IncidentSourceType,
  { id, name }: Pick<IncidentSource, "id" | "name">,
): IncidentSource => ({ type, id, name });

export const seedIncidents = (
  monitors: readonly Monitor[],
  webhooks: readonly Webhook[],
): Incident[] => {
  const [publicApi, payments, legacy] = monitors;
  const [, github] = webhooks;

  if (!publicApi || !payments || !legacy || !github) {
    return [];
  }

  return [
    {
      id: seedId(INCIDENT_NAMESPACE, 1),
      source: sourceOf("monitor", legacy),
      status: "open",
      cause: "Connection timed out after 10000 ms",
      startedAt: minutesAgo(30),
      acknowledgedAt: null,
      resolvedAt: null,
    },
    {
      id: seedId(INCIDENT_NAMESPACE, 2),
      source: sourceOf("webhook", github),
      status: "open",
      cause: "No events received within 1d",
      startedAt: minutesAgo(180),
      acknowledgedAt: null,
      resolvedAt: null,
    },
    {
      id: seedId(INCIDENT_NAMESPACE, 3),
      source: sourceOf("monitor", payments),
      status: "acknowledged",
      cause: "Response time above 800 ms",
      startedAt: minutesAgo(5),
      acknowledgedAt: minutesAgo(2),
      resolvedAt: null,
    },
    {
      id: seedId(INCIDENT_NAMESPACE, 4),
      source: sourceOf("monitor", publicApi),
      status: "resolved",
      cause: "HTTP 503 Service Unavailable",
      startedAt: minutesAgo(45),
      acknowledgedAt: minutesAgo(43),
      resolvedAt: minutesAgo(39),
    },
  ];
};

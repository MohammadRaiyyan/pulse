import type {
  Incident,
  IncidentActor,
  IncidentSource,
  IncidentSourceType,
  Monitor,
  User,
  Webhook,
} from "@pulse/contracts";
import { seedId } from "../lib/ids";
import { minutesAgo } from "../lib/time";

const INCIDENT_NAMESPACE = 20;

const sourceOf = (
  type: IncidentSourceType,
  { id, name }: Pick<IncidentSource, "id" | "name">,
): IncidentSource => ({ type, id, name, isDeleted: false });

const actorOf = ({ id, name }: User): IncidentActor => ({ id, name });

export const seedIncidents = (
  users: readonly User[],
  monitors: readonly Monitor[],
  webhooks: readonly Webhook[],
): Incident[] => {
  const [owner, admin] = users;
  const [publicApi, payments, legacy] = monitors;
  const [, github] = webhooks;

  if (!owner || !admin || !publicApi || !payments || !legacy || !github) {
    return [];
  }

  return [
    {
      id: seedId(INCIDENT_NAMESPACE, 1),
      source: sourceOf("monitor", legacy),
      status: "open",
      severity: "critical",
      cause: "Connection timed out after 10000 ms",
      startedAt: minutesAgo(30),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      resolutionReason: null,
    },
    {
      id: seedId(INCIDENT_NAMESPACE, 2),
      source: sourceOf("webhook", github),
      status: "open",
      severity: "critical",
      cause: "No events received within 1d",
      startedAt: minutesAgo(180),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      resolutionReason: null,
    },
    {
      id: seedId(INCIDENT_NAMESPACE, 3),
      source: sourceOf("monitor", payments),
      status: "acknowledged",
      severity: "warning",
      cause: "Response time above 800 ms",
      startedAt: minutesAgo(5),
      acknowledgedAt: minutesAgo(2),
      acknowledgedBy: actorOf(admin),
      resolvedAt: null,
      resolvedBy: null,
      resolutionReason: null,
    },
    {
      id: seedId(INCIDENT_NAMESPACE, 4),
      source: sourceOf("monitor", publicApi),
      status: "resolved",
      severity: "critical",
      cause: "HTTP 503 Service Unavailable",
      startedAt: minutesAgo(45),
      acknowledgedAt: minutesAgo(43),
      acknowledgedBy: actorOf(owner),
      resolvedAt: minutesAgo(39),
      resolvedBy: null,
      resolutionReason: "recovered",
    },
    {
      id: seedId(INCIDENT_NAMESPACE, 5),
      source: {
        type: "monitor",
        id: seedId(INCIDENT_NAMESPACE, 99),
        name: "Old status page",
        isDeleted: true,
      },
      status: "resolved",
      severity: "critical",
      cause: "Expected HTTP 200, got 502",
      startedAt: minutesAgo(2_900),
      acknowledgedAt: minutesAgo(2_880),
      acknowledgedBy: actorOf(admin),
      resolvedAt: minutesAgo(2_820),
      resolvedBy: actorOf(admin),
      resolutionReason: null,
    },
  ];
};

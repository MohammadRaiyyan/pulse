import type { PublicIncident } from "@pulse/contracts";
import { StatusBadge } from "@/components/data/status-badge";
import { IncidentSeverityBadge } from "@/features/incidents/components/incident-severity-badge";
import { formatDateTime } from "@/lib/format/date";
import { publicIncidentStateMeta } from "../status-page-meta";

const describeTimes = ({ startedAt, resolvedAt }: PublicIncident) =>
  resolvedAt
    ? `Started ${formatDateTime(startedAt)} · Resolved ${formatDateTime(resolvedAt)}`
    : `Started ${formatDateTime(startedAt)}`;

type PublicIncidentListProps = {
  incidents: readonly PublicIncident[];
  emptyMessage: string;
};

export const PublicIncidentList = ({
  incidents,
  emptyMessage,
}: PublicIncidentListProps) =>
  incidents.length === 0 ? (
    <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
      {emptyMessage}
    </p>
  ) : (
    <ul className="divide-y rounded-xl border bg-card">
      {incidents.map((incident) => (
        <li key={incident.id} className="flex flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{incident.serviceName}</span>
            <IncidentSeverityBadge value={incident.severity} />
            <StatusBadge {...publicIncidentStateMeta[incident.state]} />
          </div>
          <p className="text-sm text-muted-foreground">
            {describeTimes(incident)}
          </p>
        </li>
      ))}
    </ul>
  );

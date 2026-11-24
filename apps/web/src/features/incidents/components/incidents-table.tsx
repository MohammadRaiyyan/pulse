import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { ActionsSkeleton } from "@/components/skeleton/actions-skeleton";
import type { Incident } from "@pulse/contracts";
import { ShieldCheckIcon } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { useCan } from "@/features/auth/hooks/use-can";
import { formatRelativeTime } from "@/lib/format/date";
import { formatDuration } from "@/lib/format/number";
import { getIncidentDurationSeconds } from "../incident-duration";
import { type IncidentView, incidentViewMeta } from "../incident-meta";
import { IncidentActions } from "./incident-actions";
import { IncidentActorNote } from "./incident-actor-note";
import { IncidentSeverityBadge } from "./incident-severity-badge";
import { IncidentSourceLink } from "./incident-source-link";
import { IncidentStatusBadge } from "./incident-status-badge";

const useIncidentColumns = (): DataTableColumn<Incident>[] => [
  {
    id: "source",
    header: "Source",
    skeleton: <TextSkeleton className="w-36" />,
    cell: (incident) => <IncidentSourceLink source={incident.source} />,
  },
  {
    id: "cause",
    header: "Cause",
    skeleton: <TextSkeleton className="w-48" />,
    className: "max-w-56 truncate text-muted-foreground",
    cell: (incident) => incident.cause,
  },
  {
    id: "severity",
    header: "Severity",
    skeleton: <BadgeSkeleton />,
    cell: (incident) => <IncidentSeverityBadge value={incident.severity} />,
  },
  {
    id: "status",
    header: "Status",
    skeleton: <BadgeSkeleton />,
    cell: (incident) => (
      <div className="flex flex-col items-start gap-1">
        <IncidentStatusBadge value={incident.status} />
        <IncidentActorNote incident={incident} />
      </div>
    ),
  },
  {
    id: "started",
    header: "Started",
    cell: (incident) => formatRelativeTime(incident.startedAt),
  },
  {
    id: "duration",
    header: "Duration",
    cell: (incident) => formatDuration(getIncidentDurationSeconds(incident)),
  },
  {
    id: "actions",
    header: "",
    skeleton: <ActionsSkeleton count={2} />,
    className: "text-right",
    hidden: !useCan("incident:manage"),
    cell: (incident) => <IncidentActions incident={incident} />,
  },
];

type IncidentsTableProps = {
  incidents: readonly Incident[];
  view: IncidentView;
};

export const IncidentsTable = ({ incidents, view }: IncidentsTableProps) => {
  const columns = useIncidentColumns();
  const { emptyTitle, emptyDescription } = incidentViewMeta[view];

  return (
    <DataTable
      columns={columns}
      rows={incidents}
      getRowId={(incident) => incident.id}
      emptyState={
        <EmptyState
          icon={ShieldCheckIcon}
          title={emptyTitle}
          description={emptyDescription}
        />
      }
    />
  );
};

export const IncidentsTableSkeleton = ({ rows }: { rows?: number }) => (
  <DataTableSkeleton columns={useIncidentColumns()} rows={rows} />
);

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
import { IncidentActions } from "./incident-actions";
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
    className: "max-w-72 truncate text-muted-foreground",
    cell: (incident) => incident.cause,
  },
  {
    id: "status",
    header: "Status",
    skeleton: <BadgeSkeleton />,
    cell: (incident) => <IncidentStatusBadge value={incident.status} />,
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

export const IncidentsTable = ({
  incidents,
}: {
  incidents: readonly Incident[];
}) => {
  const columns = useIncidentColumns();

  return (
    <DataTable
      columns={columns}
      rows={incidents}
      getRowId={(incident) => incident.id}
      emptyState={
        <EmptyState
          icon={ShieldCheckIcon}
          title="No incidents"
          description="Everything is operating normally."
        />
      }
    />
  );
};

export const IncidentsTableSkeleton = ({ rows }: { rows?: number }) => (
  <DataTableSkeleton columns={useIncidentColumns()} rows={rows} />
);

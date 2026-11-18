import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { StackedSkeleton } from "@/components/skeleton/stacked-skeleton";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import type { Monitor } from "@pulse/contracts";
import { ActivityIcon } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { TableLink } from "@/components/data/table-link";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatRelativeTime } from "@/lib/format/date";
import { formatDuration, formatMilliseconds } from "@/lib/format/number";
import { MonitorStateBadge } from "./monitor-state-badge";
import { MonitorTarget } from "./monitor-target";
import { NewMonitorButton } from "./new-monitor-button";
import { UptimeValue } from "./uptime-value";

const columns: DataTableColumn<Monitor>[] = [
  {
    id: "name",
    header: "Monitor",
    skeleton: <StackedSkeleton />,
    className: "max-w-80",
    cell: (monitor) => (
      <div className="flex min-w-0 flex-col gap-1">
        <TableLink to="/monitors/$monitorId" params={{ monitorId: monitor.id }}>
          {monitor.name}
        </TableLink>
        <MonitorTarget monitor={monitor} />
      </div>
    ),
  },
  {
    id: "status",
    header: "Status",
    skeleton: <BadgeSkeleton />,
    cell: (monitor) => <MonitorStateBadge monitor={monitor} />,
  },
  {
    id: "interval",
    header: "Every",
    className: "numeric",
    cell: (monitor) => formatDuration(monitor.intervalSeconds),
  },
  {
    id: "response",
    header: "Response",
    className: "numeric",
    cell: (monitor) => formatMilliseconds(monitor.lastResponseTimeMs),
  },
  {
    id: "uptime",
    header: "Uptime",
    cell: (monitor) => <UptimeValue percent={monitor.uptimePercent} />,
  },
  {
    id: "checked",
    header: "Last check",
    cell: (monitor) => formatRelativeTime(monitor.lastCheckedAt),
  },
];

export const MonitorsTable = ({
  monitors,
}: {
  monitors: readonly Monitor[];
}) => (
  <DataTable
    columns={columns}
    rows={monitors}
    getRowId={(monitor) => monitor.id}
    emptyState={
      <EmptyState
        icon={ActivityIcon}
        title="No monitors found"
        description="Create a monitor to start checking an API endpoint on a schedule."
        action={<NewMonitorButton />}
      />
    }
  />
);

export const MonitorsTableSkeleton = ({ rows }: { rows?: number }) => (
  <DataTableSkeleton columns={columns} rows={rows} />
);

import type { ReportMonitor, SlaStatus } from "@pulse/contracts";
import { cn } from "@pulse/ui/lib/utils";
import { ActivityIcon } from "lucide-react";
import { useState } from "react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { StatusBadge } from "@/components/data/status-badge";
import { TableLink } from "@/components/data/table-link";
import { toneStyles } from "@/components/data/tones";
import { EmptyState } from "@/components/feedback/empty-state";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { EMPTY_VALUE } from "@/lib/format/placeholder";
import {
  formatCount,
  formatDuration,
  formatMilliseconds,
} from "@/lib/format/number";
import { formatUptime, slaStatusMeta } from "../report-meta";
import { type SortState, compareValues } from "../report-sort";
import { SortableHeader } from "./sortable-header";

type MonitorSortKey =
  | "name"
  | "service"
  | "uptime"
  | "response"
  | "checks"
  | "down"
  | "degraded"
  | "incidents"
  | "downtime";

const sortValues: Record<
  MonitorSortKey,
  (monitor: ReportMonitor) => string | number | null
> = {
  name: (monitor) => monitor.name,
  service: (monitor) => monitor.serviceName,
  uptime: (monitor) => monitor.uptimePercent,
  response: (monitor) => monitor.averageResponseTimeMs,
  checks: (monitor) => monitor.checks,
  down: (monitor) => monitor.downChecks,
  degraded: (monitor) => monitor.degradedChecks,
  incidents: (monitor) => monitor.incidents,
  downtime: (monitor) => monitor.downtimeSeconds,
};

const DEFAULT_SORT: SortState<MonitorSortKey> = {
  key: "uptime",
  direction: "asc",
};

export const UptimeAgainstSla = ({
  percent,
  status,
}: {
  percent: number | null;
  status: SlaStatus;
}) => (
  <span
    className={cn(
      "numeric font-medium",
      toneStyles[slaStatusMeta[status].tone].text,
    )}
  >
    {formatUptime(percent)}
  </span>
);

const buildColumns = (
  sort: SortState<MonitorSortKey>,
  onSort: (sort: SortState<MonitorSortKey>) => void,
): DataTableColumn<ReportMonitor>[] => {
  const header = (label: string, sortKey: MonitorSortKey) => (
    <SortableHeader
      label={label}
      sortKey={sortKey}
      sort={sort}
      onSort={onSort}
    />
  );

  return [
    {
      id: "name",
      header: header("Monitor", "name"),
      skeleton: <TextSkeleton className="w-36" />,
      className: "max-w-72 truncate",
      cell: (monitor) => (
        <TableLink to="/monitors/$monitorId" params={{ monitorId: monitor.id }}>
          {monitor.name}
        </TableLink>
      ),
    },
    {
      id: "service",
      header: header("Service", "service"),
      className: "text-muted-foreground",
      cell: (monitor) => monitor.serviceName ?? EMPTY_VALUE,
    },
    {
      id: "uptime",
      header: header("Uptime", "uptime"),
      cell: (monitor) => (
        <UptimeAgainstSla
          percent={monitor.uptimePercent}
          status={monitor.slaStatus}
        />
      ),
    },
    {
      id: "sla",
      header: "SLA",
      skeleton: <BadgeSkeleton />,
      cell: (monitor) => <StatusBadge {...slaStatusMeta[monitor.slaStatus]} />,
    },
    {
      id: "response",
      header: header("Avg response", "response"),
      className: "numeric",
      cell: (monitor) => formatMilliseconds(monitor.averageResponseTimeMs),
    },
    {
      id: "checks",
      header: header("Checks", "checks"),
      className: "numeric",
      cell: (monitor) => formatCount(monitor.checks),
    },
    {
      id: "down",
      header: header("Down", "down"),
      className: "numeric",
      cell: (monitor) => formatCount(monitor.downChecks),
    },
    {
      id: "degraded",
      header: header("Degraded", "degraded"),
      className: "numeric",
      cell: (monitor) => formatCount(monitor.degradedChecks),
    },
    {
      id: "incidents",
      header: header("Incidents", "incidents"),
      className: "numeric",
      cell: (monitor) => formatCount(monitor.incidents),
    },
    {
      id: "downtime",
      header: header("Downtime", "downtime"),
      className: "numeric",
      cell: (monitor) => formatDuration(monitor.downtimeSeconds),
    },
  ];
};

export const ReportMonitorsTable = ({
  monitors,
}: {
  monitors: readonly ReportMonitor[];
}) => {
  const [sort, setSort] = useState(DEFAULT_SORT);
  const pick = sortValues[sort.key];
  const rows = monitors.toSorted(
    (left, right) =>
      compareValues(pick(left), pick(right), sort.direction) ||
      left.name.localeCompare(right.name),
  );

  return (
    <DataTable
      columns={buildColumns(sort, setSort)}
      rows={rows}
      getRowId={(monitor) => monitor.id}
      emptyState={
        <EmptyState
          icon={ActivityIcon}
          title="No monitors"
          description="Create a monitor to see its uptime here."
        />
      }
    />
  );
};

export const ReportMonitorsTableSkeleton = () => (
  <DataTableSkeleton columns={buildColumns(DEFAULT_SORT, () => undefined)} />
);

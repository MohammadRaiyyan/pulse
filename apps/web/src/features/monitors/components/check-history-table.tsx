import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import type { CheckResult } from "@pulse/contracts";
import { HistoryIcon } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime } from "@/lib/format/date";
import { formatMilliseconds } from "@/lib/format/number";
import { EMPTY_VALUE } from "@/lib/format/placeholder";
import { MonitorStatusBadge } from "./monitor-status-badge";

const columns: DataTableColumn<CheckResult>[] = [
  {
    id: "checkedAt",
    header: "Checked at",
    className: "numeric text-muted-foreground",
    cell: (check) => formatDateTime(check.checkedAt),
  },
  {
    id: "outcome",
    header: "Outcome",
    skeleton: <BadgeSkeleton />,
    cell: (check) => <MonitorStatusBadge value={check.outcome} />,
  },
  {
    id: "statusCode",
    header: "Status code",
    className: "numeric",
    cell: (check) => check.statusCode ?? EMPTY_VALUE,
  },
  {
    id: "responseTime",
    header: "Response time",
    className: "numeric",
    cell: (check) => formatMilliseconds(check.responseTimeMs),
  },
  {
    id: "error",
    header: "Error",
    skeleton: <TextSkeleton className="w-40" />,
    className: "max-w-64 truncate text-muted-foreground",
    cell: (check) => check.errorMessage ?? EMPTY_VALUE,
  },
];

export const CheckHistoryTable = ({
  checks,
}: {
  checks: readonly CheckResult[];
}) => (
  <DataTable
    columns={columns}
    rows={checks}
    getRowId={(check) => check.id}
    emptyState={
      <EmptyState
        icon={HistoryIcon}
        title="No checks yet"
        description="Check results will be listed here."
      />
    }
  />
);

export const CheckHistoryTableSkeleton = ({ rows }: { rows?: number }) => (
  <DataTableSkeleton columns={columns} rows={rows} />
);

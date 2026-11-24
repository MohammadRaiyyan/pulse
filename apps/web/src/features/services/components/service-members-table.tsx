import type { ServiceOverview } from "@pulse/contracts";
import { ActivityIcon } from "lucide-react";
import type { ReactNode } from "react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { StatusBadge } from "@/components/data/status-badge";
import { TableLink } from "@/components/data/table-link";
import { EmptyState } from "@/components/feedback/empty-state";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { MonitorStatusBadge } from "@/features/monitors/components/monitor-status-badge";
import { UptimeValue } from "@/features/monitors/components/uptime-value";
import { pausedMeta } from "@/features/monitors/monitor-meta";
import { WebhookStatusBadge } from "@/features/webhooks/components/webhook-status-badge";

type MemberRow = {
  id: string;
  name: ReactNode;
  type: string;
  status: ReactNode;
  uptime: ReactNode;
};

const columns: DataTableColumn<MemberRow>[] = [
  {
    id: "name",
    header: "Member",
    skeleton: <TextSkeleton className="w-32" />,
    cell: (row) => row.name,
  },
  {
    id: "type",
    header: "Type",
    className: "text-muted-foreground",
    cell: (row) => row.type,
  },
  {
    id: "status",
    header: "Status",
    skeleton: <BadgeSkeleton />,
    cell: (row) => row.status,
  },
  {
    id: "uptime",
    header: "Uptime (24h)",
    cell: (row) => row.uptime,
  },
];

const toRows = ({ monitors, webhooks }: ServiceOverview): MemberRow[] => [
  ...monitors.map((monitor) => ({
    id: monitor.id,
    name: (
      <TableLink to="/monitors/$monitorId" params={{ monitorId: monitor.id }}>
        {monitor.name}
      </TableLink>
    ),
    type: "Monitor",
    status: monitor.isPaused ? (
      <StatusBadge {...pausedMeta} />
    ) : (
      <MonitorStatusBadge value={monitor.status} />
    ),
    uptime: <UptimeValue percent={monitor.uptimePercent} />,
  })),
  ...webhooks.map((webhook) => ({
    id: webhook.id,
    name: (
      <TableLink to="/webhooks/$webhookId" params={{ webhookId: webhook.id }}>
        {webhook.name}
      </TableLink>
    ),
    type: "Webhook",
    status: <WebhookStatusBadge value={webhook.status} />,
    uptime: <span className="text-muted-foreground">Not tracked</span>,
  })),
];

export const ServiceMembersTable = ({
  overview,
}: {
  overview: ServiceOverview;
}) => (
  <DataTable
    columns={columns}
    rows={toRows(overview)}
    getRowId={(row) => row.id}
    emptyState={
      <EmptyState
        icon={ActivityIcon}
        title="No members"
        description="Edit the service, or pick it in a monitor or webhook form, to add members."
      />
    }
  />
);

export const ServiceMembersTableSkeleton = () => (
  <DataTableSkeleton columns={columns} rows={3} />
);

import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { ActionsSkeleton } from "@/components/skeleton/actions-skeleton";
import type { WebhookEvent } from "@pulse/contracts";
import { InboxIcon } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { MethodBadge } from "@/components/data/method-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatDateTime } from "@/lib/format/date";
import { EMPTY_VALUE } from "@/lib/format/placeholder";
import { WebhookEventDialog } from "./webhook-event-dialog";

const columns: DataTableColumn<WebhookEvent>[] = [
  {
    id: "receivedAt",
    header: "Received",
    cell: (event) => formatDateTime(event.receivedAt),
  },
  {
    id: "method",
    header: "Method",
    skeleton: <BadgeSkeleton />,
    cell: (event) => <MethodBadge method={event.method} />,
  },
  {
    id: "contentType",
    header: "Content type",
    cell: (event) => event.contentType ?? EMPTY_VALUE,
  },
  {
    id: "sourceIp",
    header: "Source IP",
    cell: (event) => <code className="text-xs">{event.sourceIp}</code>,
  },
  {
    id: "inspect",
    header: "",
    skeleton: <ActionsSkeleton count={1} />,
    className: "text-right",
    cell: (event) => <WebhookEventDialog event={event} />,
  },
];

export const WebhookEventsTable = ({
  events,
}: {
  events: readonly WebhookEvent[];
}) => (
  <DataTable
    columns={columns}
    rows={events}
    getRowId={(event) => event.id}
    emptyState={
      <EmptyState
        icon={InboxIcon}
        title="No events received"
        description="Send a request to the ingest URL and it will show up here."
      />
    }
  />
);

export const WebhookEventsTableSkeleton = ({ rows }: { rows?: number }) => (
  <DataTableSkeleton columns={columns} rows={rows} />
);

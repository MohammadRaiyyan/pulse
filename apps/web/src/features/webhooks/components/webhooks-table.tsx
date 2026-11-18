import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import type { Webhook } from "@pulse/contracts";
import { WebhookIcon } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { TableLink } from "@/components/data/table-link";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatRelativeTime } from "@/lib/format/date";
import { formatCount } from "@/lib/format/number";
import { IngestUrl } from "./ingest-url";
import { NewWebhookButton } from "./new-webhook-button";
import { WebhookStatusBadge } from "./webhook-status-badge";

const columns: DataTableColumn<Webhook>[] = [
  {
    id: "name",
    header: "Endpoint",
    skeleton: <TextSkeleton className="w-32" />,
    cell: (webhook) => (
      <TableLink to="/webhooks/$webhookId" params={{ webhookId: webhook.id }}>
        {webhook.name}
      </TableLink>
    ),
  },
  {
    id: "status",
    header: "Status",
    skeleton: <BadgeSkeleton />,
    cell: (webhook) => <WebhookStatusBadge value={webhook.status} />,
  },
  {
    id: "ingestUrl",
    header: "Ingest URL",
    skeleton: <TextSkeleton className="w-56" />,
    className: "max-w-72",
    cell: (webhook) => <IngestUrl url={webhook.ingestUrl} />,
  },
  {
    id: "events",
    header: "Events",
    cell: (webhook) => formatCount(webhook.eventCount),
  },
  {
    id: "lastReceived",
    header: "Last event",
    cell: (webhook) => formatRelativeTime(webhook.lastReceivedAt),
  },
];

export const WebhooksTable = ({
  webhooks,
}: {
  webhooks: readonly Webhook[];
}) => (
  <DataTable
    columns={columns}
    rows={webhooks}
    getRowId={(webhook) => webhook.id}
    emptyState={
      <EmptyState
        icon={WebhookIcon}
        title="No webhook endpoints"
        description="Create an endpoint to capture and inspect incoming webhooks."
        action={<NewWebhookButton />}
      />
    }
  />
);

export const WebhooksTableSkeleton = ({ rows }: { rows?: number }) => (
  <DataTableSkeleton columns={columns} rows={rows} />
);

import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { ActionsSkeleton } from "@/components/skeleton/actions-skeleton";
import { Skeleton } from "@pulse/ui/components/skeleton";
import type { AlertChannel } from "@pulse/contracts";
import { BellRingIcon } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { useCan } from "@/features/auth/hooks/use-can";
import { AlertChannelRowActions } from "./alert-channel-row-actions";
import { ChannelEnabledSwitch } from "./channel-enabled-switch";
import { ChannelTypeLabel } from "./channel-type-label";
import { LastDelivery } from "./last-delivery";
import { NewAlertChannelButton } from "./new-alert-channel-button";

const useAlertChannelColumns = (): DataTableColumn<AlertChannel>[] => [
  {
    id: "name",
    header: "Name",
    cell: (channel) => <span className="font-medium">{channel.name}</span>,
  },
  {
    id: "type",
    header: "Type",
    cell: (channel) => <ChannelTypeLabel type={channel.destination.type} />,
  },
  {
    id: "target",
    header: "Target",
    skeleton: <TextSkeleton className="w-48" />,
    className: "max-w-72 truncate font-mono text-xs",
    cell: (channel) => channel.destination.target,
  },
  {
    id: "lastDelivery",
    header: "Last delivery",
    skeleton: <TextSkeleton className="w-28" />,
    cell: (channel) => <LastDelivery delivery={channel.lastDelivery} />,
  },
  {
    id: "enabled",
    header: "Enabled",
    skeleton: <Skeleton className="h-5 w-9 rounded-sm" />,
    cell: (channel) => <ChannelEnabledSwitch channel={channel} />,
  },
  {
    id: "actions",
    header: "",
    skeleton: <ActionsSkeleton count={4} iconOnly />,
    className: "text-right",
    hidden: !useCan("alert-channel:write"),
    cell: (channel) => <AlertChannelRowActions channel={channel} />,
  },
];

export const AlertChannelsTable = ({
  channels,
}: {
  channels: readonly AlertChannel[];
}) => {
  const columns = useAlertChannelColumns();

  return (
    <DataTable
      columns={columns}
      rows={channels}
      getRowId={(channel) => channel.id}
      emptyState={
        <EmptyState
          icon={BellRingIcon}
          title="No alert channels"
          description="Add email, Slack or webhook channels to get notified about incidents."
          action={<NewAlertChannelButton />}
        />
      }
    />
  );
};

export const AlertChannelsTableSkeleton = ({ rows }: { rows?: number }) => (
  <DataTableSkeleton columns={useAlertChannelColumns()} rows={rows} />
);

import type { AlertChannelType } from "@pulse/contracts";
import { channelTypeMeta } from "../alert-channel-meta";

export const ChannelTypeLabel = ({ type }: { type: AlertChannelType }) => {
  const { icon: Icon, label } = channelTypeMeta[type];

  return (
    <span className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      {label}
    </span>
  );
};

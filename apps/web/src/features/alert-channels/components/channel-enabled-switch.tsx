import type { AlertChannel } from "@pulse/contracts";
import { Switch } from "@pulse/ui/components/switch";
import { useCan } from "@/features/auth/hooks/use-can";
import { useUpdateAlertChannel } from "../api/alert-channel-resource";

export const ChannelEnabledSwitch = ({
  channel,
}: {
  channel: AlertChannel;
}) => {
  const canWrite = useCan("alert-channel:write");
  const updateChannel = useUpdateAlertChannel({
    optimistic: true,
    successMessage: (updated) =>
      `${updated.name} ${updated.isEnabled ? "enabled" : "disabled"}`,
  });

  return (
    <Switch
      checked={channel.isEnabled}
      onCheckedChange={(isEnabled) =>
        updateChannel.mutate({ id: channel.id, input: { isEnabled } })
      }
      disabled={!canWrite || updateChannel.isPending}
      aria-label={`Toggle ${channel.name}`}
    />
  );
};

import type { AlertChannel } from "@pulse/contracts";
import { Switch } from "@pulse/ui/components/switch";
import { useCan } from "@/features/auth/hooks/use-can";
import { useUpdateResource } from "@/lib/query/use-resource-mutations";
import { alertChannelResource } from "../api/alert-channel-resource";

export const ChannelEnabledSwitch = ({
  channel,
}: {
  channel: AlertChannel;
}) => {
  const canWrite = useCan("alert-channel:write");
  const updateChannel = useUpdateResource(alertChannelResource, {
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

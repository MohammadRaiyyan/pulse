import type { AlertChannel } from "@pulse/contracts";
import { SendIcon } from "lucide-react";
import { DeleteResourceButton } from "@/components/actions/delete-resource-button";
import { IconButton } from "@/components/actions/icon-button";
import { RowActions } from "@/components/actions/row-actions";
import {
  alertChannelResource,
  useTestAlertChannel,
} from "../api/alert-channel-resource";
import { EditAlertChannelDialog } from "./edit-alert-channel-dialog";
import { SigningSecretDialog } from "./signing-secret-dialog";

type ChannelProps = { channel: AlertChannel };

const TestChannelButton = ({ channel }: ChannelProps) => {
  const testChannel = useTestAlertChannel();

  return (
    <IconButton
      disabled={testChannel.isPending || !channel.isEnabled}
      onClick={() => testChannel.mutate({ id: channel.id, name: channel.name })}
      label={`Send test alert to ${channel.name}`}
    >
      <SendIcon />
    </IconButton>
  );
};

export const AlertChannelRowActions = ({ channel }: ChannelProps) => (
  <RowActions>
    <TestChannelButton channel={channel} />
    {channel.destination.type === "webhook" ? (
      <SigningSecretDialog channel={channel} />
    ) : null}
    <EditAlertChannelDialog channel={channel} />
    <DeleteResourceButton
      resource={alertChannelResource}
      id={channel.id}
      name={channel.name}
      consequence="Monitors and webhooks using this integration will stop notifying it."
      iconOnly
    />
  </RowActions>
);

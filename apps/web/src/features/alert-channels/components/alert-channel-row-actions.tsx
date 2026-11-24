import { type AlertChannel, createAlertChannelSchema } from "@pulse/contracts";
import { PencilIcon, SendIcon } from "lucide-react";
import { DeleteResourceButton } from "@/components/actions/delete-resource-button";
import { IconButton } from "@/components/actions/icon-button";
import { RowActions } from "@/components/actions/row-actions";
import { EditResourceDialog } from "@/components/dialogs/edit-resource-dialog";
import {
  alertChannelResource,
  useTestAlertChannel,
} from "../api/alert-channel-resource";
import { AlertChannelForm } from "./alert-channel-form";
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
    <EditResourceDialog
      resource={alertChannelResource}
      item={channel}
      toInput={(item) => createAlertChannelSchema.parse(item)}
      form={AlertChannelForm}
      title={`Edit ${channel.name}`}
      description="Update where and how this channel delivers alerts."
      trigger={
        <IconButton label={`Edit ${channel.name}`}>
          <PencilIcon />
        </IconButton>
      }
    />
    <DeleteResourceButton
      resource={alertChannelResource}
      id={channel.id}
      name={channel.name}
      consequence="Monitors and webhooks using this channel will stop notifying it."
      iconOnly
    />
  </RowActions>
);

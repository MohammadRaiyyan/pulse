import type { AlertChannel } from "@pulse/contracts";
import { PencilIcon } from "lucide-react";
import { IconButton } from "@/components/actions/icon-button";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { inlineErrors } from "@/lib/query/meta";
import {
  editAlertChannelSchema,
  toAlertChannelFormValues,
} from "../alert-channel-defaults";
import { channelTypeMeta } from "../alert-channel-meta";
import { useUpdateAlertChannel } from "../api/alert-channel-resource";
import { AlertChannelForm } from "./alert-channel-form";

export const EditAlertChannelDialog = ({
  channel,
}: {
  channel: AlertChannel;
}) => {
  const updateChannel = useUpdateAlertChannel({
    successMessage: (updated) => `${updated.name} updated`,
    meta: inlineErrors,
  });

  return (
    <FormDialog
      title={`Edit ${channel.name}`}
      description={`Update how this ${channelTypeMeta[channel.destination.type].label} integration delivers alerts.`}
      trigger={
        <IconButton label={`Edit ${channel.name}`}>
          <PencilIcon />
        </IconButton>
      }
    >
      {({ close, closeAfter }) => (
        <AlertChannelForm
          isEditing
          defaultValues={toAlertChannelFormValues(channel)}
          submitLabel="Save changes"
          onCancel={close}
          onSubmit={closeAfter((values) =>
            updateChannel.mutateAsync({
              id: channel.id,
              input: editAlertChannelSchema.parse(values),
            }),
          )}
        />
      )}
    </FormDialog>
  );
};

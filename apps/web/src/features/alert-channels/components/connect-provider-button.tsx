import {
  type AlertChannelType,
  createAlertChannelSchema,
} from "@pulse/contracts";
import { PlugIcon } from "lucide-react";
import { ActionButton } from "@/components/actions/action-button";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { Can } from "@/features/auth/components/can";
import { inlineErrors } from "@/lib/query/meta";
import { useCreateResource } from "@/lib/query/use-resource-mutations";
import { alertChannelDefaults } from "../alert-channel-defaults";
import { channelTypeMeta } from "../alert-channel-meta";
import { alertChannelResource } from "../api/alert-channel-resource";
import { AlertChannelForm } from "./alert-channel-form";

const ConnectProviderDialog = ({ type }: { type: AlertChannelType }) => {
  const { label } = channelTypeMeta[type];
  const createChannel = useCreateResource(alertChannelResource, {
    successMessage: (channel) => `${channel.name} connected`,
    meta: inlineErrors,
  });

  return (
    <FormDialog
      title={`Connect ${label}`}
      description={`Send Pulse incident alerts to ${label} when something breaks.`}
      trigger={
        <ActionButton
          variant="outline"
          size="sm"
          icon={PlugIcon}
          label="Connect"
          aria-label={`Connect ${label}`}
        />
      }
    >
      {({ close, closeAfter }) => (
        <AlertChannelForm
          defaultValues={alertChannelDefaults(type)}
          submitLabel="Connect"
          onCancel={close}
          onSubmit={closeAfter((values) =>
            createChannel.mutateAsync(createAlertChannelSchema.parse(values)),
          )}
        />
      )}
    </FormDialog>
  );
};

export const ConnectProviderButton = ({ type }: { type: AlertChannelType }) => (
  <Can permission="alert-channel:write">
    <ConnectProviderDialog type={type} />
  </Can>
);

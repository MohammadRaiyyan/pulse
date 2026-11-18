import { CreateButton } from "@/components/actions/create-button";
import { CreateResourceDialog } from "@/components/dialogs/create-resource-dialog";
import { Can } from "@/features/auth/components/can";
import { defaultAlertChannelInput } from "../alert-channel-defaults";
import { alertChannelResource } from "../api/alert-channel-resource";
import { AlertChannelForm } from "./alert-channel-form";

export const NewAlertChannelButton = () => (
  <Can permission="alert-channel:write">
    <CreateResourceDialog
      resource={alertChannelResource}
      form={AlertChannelForm}
      defaultValues={defaultAlertChannelInput}
      title="New alert channel"
      description="Choose where Pulse sends notifications when something breaks."
      submitLabel="Create channel"
      trigger={<CreateButton label="New channel" />}
    />
  </Can>
);

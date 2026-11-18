import { type Webhook, createWebhookSchema } from "@pulse/contracts";
import { DeleteResourceButton } from "@/components/actions/delete-resource-button";
import { EditButton } from "@/components/actions/edit-button";
import { EditResourceDialog } from "@/components/dialogs/edit-resource-dialog";
import { Can } from "@/features/auth/components/can";
import { webhookResource } from "../api/webhook-resource";
import { WebhookForm } from "./webhook-form";

export const WebhookActions = ({ webhook }: { webhook: Webhook }) => (
  <Can permission="webhook:write">
    <EditResourceDialog
      resource={webhookResource}
      item={webhook}
      toInput={(item) => createWebhookSchema.parse(item)}
      form={WebhookForm}
      title={`Edit ${webhook.name}`}
      description="The ingest URL stays the same."
      trigger={<EditButton />}
    />
    <DeleteResourceButton
      resource={webhookResource}
      id={webhook.id}
      name={webhook.name}
      consequence="The ingest URL stops accepting events and captured events are removed."
      redirectTo="/webhooks"
    />
  </Can>
);

import { useNavigate } from "@tanstack/react-router";
import { CreateButton } from "@/components/actions/create-button";
import { CreateResourceDialog } from "@/components/dialogs/create-resource-dialog";
import { Can } from "@/features/auth/components/can";
import { webhookResource } from "../api/webhook-resource";
import { defaultWebhookInput } from "../webhook-defaults";
import { WebhookForm } from "./webhook-form";

export const NewWebhookButton = () => {
  const navigate = useNavigate();

  return (
    <Can permission="webhook:write">
      <CreateResourceDialog
        resource={webhookResource}
        form={WebhookForm}
        defaultValues={defaultWebhookInput}
        title="New webhook endpoint"
        description="Get a unique URL to capture incoming webhooks."
        submitLabel="Create endpoint"
        trigger={<CreateButton label="New endpoint" />}
        onCreated={(webhook) =>
          navigate({
            to: "/webhooks/$webhookId",
            params: { webhookId: webhook.id },
          })
        }
      />
    </Can>
  );
};

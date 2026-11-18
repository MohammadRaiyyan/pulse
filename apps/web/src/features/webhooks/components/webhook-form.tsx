import {
  type CreateWebhookInput,
  WEBHOOK_SILENCE_LIMITS,
  createWebhookSchema,
} from "@pulse/contracts";
import type { ResourceFormProps } from "@/components/dialogs/resource-form-props";
import { useSchemaForm } from "@/components/form/app-form";
import { AlertChannelsField } from "@/features/alert-channels/components/alert-channels-field";

export const WebhookForm = ({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: ResourceFormProps<CreateWebhookInput>) => {
  const form = useSchemaForm({
    schema: createWebhookSchema,
    defaultValues,
    onSubmit,
  });

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="name">
          {(field) => (
            <field.TextField label="Name" placeholder="Stripe events" />
          )}
        </form.AppField>
        <form.AppField name="expectedIntervalSeconds">
          {(field) => (
            <field.NumberField
              label="Silence alert (seconds)"
              description="Open an incident if no event arrives within this window. Leave empty to disable."
              min={WEBHOOK_SILENCE_LIMITS.min}
              max={WEBHOOK_SILENCE_LIMITS.max}
              placeholder="Disabled"
            />
          )}
        </form.AppField>
        <form.AppField name="alertChannelIds">
          {() => <AlertChannelsField />}
        </form.AppField>
        <form.FormActions submitLabel={submitLabel} onCancel={onCancel} />
      </form.Form>
    </form.AppForm>
  );
};

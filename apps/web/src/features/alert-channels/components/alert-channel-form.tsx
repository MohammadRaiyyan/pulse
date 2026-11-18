import {
  type CreateAlertChannelInput,
  createAlertChannelSchema,
} from "@pulse/contracts";
import { useStore } from "@tanstack/react-form";
import type { ResourceFormProps } from "@/components/dialogs/resource-form-props";
import { useSchemaForm } from "@/components/form/app-form";
import { channelTypeMeta, channelTypeOptions } from "../alert-channel-meta";

export const AlertChannelForm = ({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: ResourceFormProps<CreateAlertChannelInput>) => {
  const form = useSchemaForm({
    schema: createAlertChannelSchema,
    defaultValues,
    onSubmit,
  });
  const type = useStore(form.store, (state) => state.values.destination.type);
  const typeMeta = channelTypeMeta[type];

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="name">
          {(field) => (
            <field.TextField label="Name" placeholder="On-call team" />
          )}
        </form.AppField>
        <form.AppField name="destination.type">
          {(field) => (
            <field.SelectField label="Type" options={channelTypeOptions} />
          )}
        </form.AppField>
        <form.AppField name="destination.target">
          {(field) => (
            <field.TextField
              label={typeMeta.targetLabel}
              placeholder={typeMeta.targetPlaceholder}
            />
          )}
        </form.AppField>
        <form.AppField name="isEnabled">
          {(field) => (
            <field.SwitchField
              label="Enabled"
              description="Disabled channels never receive alerts."
            />
          )}
        </form.AppField>
        <form.FormActions submitLabel={submitLabel} onCancel={onCancel} />
      </form.Form>
    </form.AppForm>
  );
};

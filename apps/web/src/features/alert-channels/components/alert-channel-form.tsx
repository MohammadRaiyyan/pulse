import { createAlertChannelSchema, isMaskedSecret } from "@pulse/contracts";
import { useStore } from "@tanstack/react-form";
import type { ResourceFormProps } from "@/components/dialogs/resource-form-props";
import { useSchemaForm } from "@/components/form/app-form";
import {
  type AlertChannelFormValues,
  editAlertChannelSchema,
} from "../alert-channel-defaults";
import {
  channelTypeMeta,
  opsgenieRegionOptions,
  unexpectedHostMessage,
} from "../alert-channel-meta";
import { ProviderSetup } from "./provider-setup";

type AlertChannelFormProps = ResourceFormProps<AlertChannelFormValues> & {
  isEditing?: boolean;
};

const savedSecretDescription = (target: string | undefined) =>
  target && isMaskedSecret(target)
    ? `Saved value ending in ${target.replace(/^•+/, "")}. Keep it as is, or paste a new one to replace it.`
    : undefined;

export const AlertChannelForm = ({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
  isEditing = false,
}: AlertChannelFormProps) => {
  const form = useSchemaForm({
    schema: isEditing ? editAlertChannelSchema : createAlertChannelSchema,
    defaultValues,
    onSubmit,
  });
  const { type } = defaultValues.destination;
  const meta = channelTypeMeta[type];
  const target = useStore(
    form.store,
    (state) => state.values.destination.target,
  );
  const hostWarning =
    target && !isMaskedSecret(target)
      ? unexpectedHostMessage(type, target)
      : undefined;

  return (
    <form.AppForm>
      <form.Form>
        {isEditing ? null : <ProviderSetup type={type} />}
        <form.AppField name="name">
          {(field) => (
            <field.TextField label="Name" placeholder={meta.namePlaceholder} />
          )}
        </form.AppField>
        <form.AppField name="destination.target">
          {(field) => (
            <field.TextField
              label={meta.targetLabel}
              placeholder={meta.targetPlaceholder}
              autoComplete="off"
              description={
                hostWarning ??
                (isEditing
                  ? savedSecretDescription(defaultValues.destination.target)
                  : undefined)
              }
            />
          )}
        </form.AppField>
        {type === "opsgenie" ? (
          <form.AppField name="destination.region">
            {(field) => (
              <field.SelectField
                label="Region"
                options={opsgenieRegionOptions}
              />
            )}
          </form.AppField>
        ) : null}
        <form.AppField name="isEnabled">
          {(field) => (
            <field.SwitchField
              label="Enabled"
              description="Disabled integrations never receive alerts."
            />
          )}
        </form.AppField>
        <form.FormActions submitLabel={submitLabel} onCancel={onCancel} />
      </form.Form>
    </form.AppForm>
  );
};

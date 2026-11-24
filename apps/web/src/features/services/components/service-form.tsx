import {
  type CreateServiceInput,
  SERVICE_LIMITS,
  createServiceSchema,
} from "@pulse/contracts";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ResourceFormProps } from "@/components/dialogs/resource-form-props";
import { useSchemaForm } from "@/components/form/app-form";
import { CheckboxGroupField } from "@/components/form/checkbox-group-field";
import {
  monitorOptionsQuery,
  webhookOptionsQuery,
} from "../api/service-resource";

const MonitorMembersField = () => {
  const { data: options } = useSuspenseQuery(monitorOptionsQuery);

  return (
    <CheckboxGroupField
      label="Monitors"
      description="A monitor belongs to one service. Picking it here moves it from its current service."
      options={options}
      emptyMessage="No monitors yet."
    />
  );
};

const WebhookMembersField = () => {
  const { data: options } = useSuspenseQuery(webhookOptionsQuery);

  return (
    <CheckboxGroupField
      label="Webhook endpoints"
      options={options}
      emptyMessage="No webhook endpoints yet."
    />
  );
};

export const ServiceForm = ({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: ResourceFormProps<CreateServiceInput>) => {
  const form = useSchemaForm({
    schema: createServiceSchema,
    defaultValues,
    onSubmit,
  });

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="name">
          {(field) => (
            <field.TextField label="Name" placeholder="Checkout" />
          )}
        </form.AppField>
        <form.AppField name="description">
          {(field) => (
            <field.TextField
              label="Description"
              description="Shown on the public status page when the service is public."
              placeholder="Carts, payments and order confirmation"
            />
          )}
        </form.AppField>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.AppField name="position">
            {(field) => (
              <field.NumberField
                label="Display order"
                description="Lower numbers are listed first."
                min={SERVICE_LIMITS.position.min}
                max={SERVICE_LIMITS.position.max}
              />
            )}
          </form.AppField>
          <form.AppField name="isPublic">
            {(field) => (
              <field.SwitchField
                label="Show on status page"
                description="Public services appear on the public status page."
              />
            )}
          </form.AppField>
        </div>
        <form.AppField name="monitorIds">
          {() => <MonitorMembersField />}
        </form.AppField>
        <form.AppField name="webhookIds">
          {() => <WebhookMembersField />}
        </form.AppField>
        <form.FormActions submitLabel={submitLabel} onCancel={onCancel} />
      </form.Form>
    </form.AppForm>
  );
};

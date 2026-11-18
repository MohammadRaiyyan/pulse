import {
  type CreateMonitorInput,
  MONITOR_LIMITS,
  createMonitorSchema,
} from "@pulse/contracts";
import type { ResourceFormProps } from "@/components/dialogs/resource-form-props";
import { useSchemaForm } from "@/components/form/app-form";
import { AlertChannelsField } from "@/features/alert-channels/components/alert-channels-field";
import { httpMethodOptions } from "../monitor-meta";

export const MonitorForm = ({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: ResourceFormProps<CreateMonitorInput>) => {
  const form = useSchemaForm({
    schema: createMonitorSchema,
    defaultValues,
    onSubmit,
  });

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="name">
          {(field) => (
            <field.TextField label="Name" placeholder="Payments API" />
          )}
        </form.AppField>
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <form.AppField name="method">
            {(field) => (
              <field.SelectField label="Method" options={httpMethodOptions} />
            )}
          </form.AppField>
          <form.AppField name="url">
            {(field) => (
              <field.TextField
                label="URL"
                type="url"
                placeholder="https://api.example.com/health"
              />
            )}
          </form.AppField>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <form.AppField name="intervalSeconds">
            {(field) => (
              <field.NumberField
                label="Interval (seconds)"
                min={MONITOR_LIMITS.intervalSeconds.min}
                max={MONITOR_LIMITS.intervalSeconds.max}
              />
            )}
          </form.AppField>
          <form.AppField name="timeoutMs">
            {(field) => (
              <field.NumberField
                label="Timeout (ms)"
                min={MONITOR_LIMITS.timeoutMs.min}
                max={MONITOR_LIMITS.timeoutMs.max}
              />
            )}
          </form.AppField>
          <form.AppField name="expectedStatusCode">
            {(field) => (
              <field.NumberField
                label="Expected status"
                min={MONITOR_LIMITS.statusCode.min}
                max={MONITOR_LIMITS.statusCode.max}
              />
            )}
          </form.AppField>
        </div>
        <form.AppField name="alertChannelIds">
          {() => (
            <AlertChannelsField description="Who gets notified when this monitor goes down." />
          )}
        </form.AppField>
        <form.FormActions submitLabel={submitLabel} onCancel={onCancel} />
      </form.Form>
    </form.AppForm>
  );
};

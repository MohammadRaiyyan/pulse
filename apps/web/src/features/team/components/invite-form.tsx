import {
  type CreateInvitationInput,
  createInvitationSchema,
} from "@pulse/contracts";
import type { ResourceFormProps } from "@/components/dialogs/resource-form-props";
import { useSchemaForm } from "@/components/form/app-form";
import { emailField } from "@/components/form/field-presets";
import { assignableRoleOptions } from "../role-meta";

export const InviteForm = ({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: ResourceFormProps<CreateInvitationInput>) => {
  const form = useSchemaForm({
    schema: createInvitationSchema,
    defaultValues,
    onSubmit,
  });

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              {...emailField}
              autoComplete="off"
              placeholder="teammate@company.com"
            />
          )}
        </form.AppField>
        <form.AppField name="role">
          {(field) => (
            <field.SelectField
              label="Role"
              description="Admins manage the team, members edit monitors, viewers only read."
              options={assignableRoleOptions}
            />
          )}
        </form.AppField>
        <form.FormActions submitLabel={submitLabel} onCancel={onCancel} />
      </form.Form>
    </form.AppForm>
  );
};

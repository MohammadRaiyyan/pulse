import { withFieldGroup } from "./app-form";
import { confirmPasswordField, newPasswordField } from "./field-presets";

export const NewPasswordFields = withFieldGroup({
  defaultValues: { password: "", confirmPassword: "" },
  props: { confirmLabel: "Confirm password" },
  render: ({ group, confirmLabel }) => (
    <>
      <group.AppField name="password">
        {(field) => (
          <field.TextField label="New password" {...newPasswordField} />
        )}
      </group.AppField>
      <group.AppField name="confirmPassword">
        {(field) => (
          <field.TextField label={confirmLabel} {...confirmPasswordField} />
        )}
      </group.AppField>
    </>
  ),
});

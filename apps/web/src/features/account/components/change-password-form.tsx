import { changePasswordSchema } from "@pulse/contracts";
import { useSchemaForm } from "@/components/form/app-form";
import { NewPasswordFields } from "@/components/form/new-password-fields";
import { currentPasswordField } from "@/components/form/field-presets";
import {
  confirmPasswordShape,
  matchesConfirmation,
  passwordMismatchIssue,
  withoutConfirmation,
} from "@/lib/forms/password-confirmation";
import { useChangePassword } from "../hooks/use-account-mutations";

const changePasswordFormSchema = changePasswordSchema
  .safeExtend(confirmPasswordShape)
  .refine(matchesConfirmation("newPassword"), passwordMismatchIssue);

const defaultValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export const ChangePasswordForm = () => {
  const changePassword = useChangePassword();
  const form = useSchemaForm({
    schema: changePasswordFormSchema,
    defaultValues,
    onSubmit: async (values) => {
      await changePassword.mutateAsync(withoutConfirmation(values));
      form.reset();
    },
  });

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="currentPassword">
          {(field) => (
            <field.TextField
              label="Current password"
              {...currentPasswordField}
            />
          )}
        </form.AppField>
        <div className="grid gap-4 sm:grid-cols-2">
          <NewPasswordFields
            form={form}
            fields={{
              password: "newPassword",
              confirmPassword: "confirmPassword",
            }}
            confirmLabel="Confirm new password"
          />
        </div>
        <div className="flex justify-end">
          <form.SubmitButton>Change password</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  );
};

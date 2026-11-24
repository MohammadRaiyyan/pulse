import { updateProfileSchema } from "@pulse/contracts";
import { useStore } from "@tanstack/react-form";
import { useSchemaForm } from "@/components/form/app-form";
import {
  currentPasswordField,
  emailField,
  fullNameField,
} from "@/components/form/field-presets";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useUpdateProfile } from "../hooks/use-account-mutations";

const isSameEmail = (value: string, email: string) =>
  value.trim().toLowerCase() === email;

export const ProfileForm = () => {
  const { name, email } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const form = useSchemaForm({
    schema: updateProfileSchema,
    defaultValues: { name, email, currentPassword: "" },
    onSubmit: async (values) => {
      await updateProfile.mutateAsync(
        isSameEmail(values.email, email)
          ? { name: values.name, email: values.email }
          : values,
      );
      form.setFieldValue("currentPassword", "");
    },
  });
  const isChangingEmail = useStore(
    form.store,
    (state) => !isSameEmail(state.values.email, email),
  );

  return (
    <form.AppForm>
      <form.Form>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.AppField name="name">
            {(field) => <field.TextField {...fullNameField} />}
          </form.AppField>
          <form.AppField name="email">
            {(field) => <field.TextField {...emailField} />}
          </form.AppField>
        </div>
        {isChangingEmail ? (
          <form.AppField name="currentPassword">
            {(field) => (
              <field.TextField
                label="Confirm with your password"
                description="Changing your email needs your current password. We will send a verification link to the new address."
                {...currentPasswordField}
              />
            )}
          </form.AppField>
        ) : null}
        <div className="flex justify-end">
          <form.SubmitButton>Save profile</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  );
};

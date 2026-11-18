import { updateProfileSchema } from "@pulse/contracts";
import { useSchemaForm } from "@/components/form/app-form";
import { emailField, fullNameField } from "@/components/form/field-presets";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useUpdateProfile } from "../hooks/use-account-mutations";

export const ProfileForm = () => {
  const { name, email } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const form = useSchemaForm({
    schema: updateProfileSchema,
    defaultValues: { name, email },
    onSubmit: updateProfile.mutateAsync,
  });

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
        <div className="flex justify-end">
          <form.SubmitButton>Save profile</form.SubmitButton>
        </div>
      </form.Form>
    </form.AppForm>
  );
};

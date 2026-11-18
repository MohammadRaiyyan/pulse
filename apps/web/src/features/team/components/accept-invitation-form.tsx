import { acceptInvitationSchema } from "@pulse/contracts";
import { Field, FieldLabel } from "@pulse/ui/components/field";
import { Input } from "@pulse/ui/components/input";
import { useId } from "react";
import { useSchemaForm } from "@/components/form/app-form";
import {
  fullNameField,
  newPasswordField,
} from "@/components/form/field-presets";
import { useAcceptInvitation } from "@/features/auth/hooks/use-auth-mutations";

const acceptFormSchema = acceptInvitationSchema.omit({ token: true });

const defaultValues = { name: "", password: "" };

type AcceptInvitationFormProps = {
  token: string;
  email: string;
};

export const AcceptInvitationForm = ({
  token,
  email,
}: AcceptInvitationFormProps) => {
  const emailFieldId = useId();
  const acceptInvitation = useAcceptInvitation();
  const form = useSchemaForm({
    schema: acceptFormSchema,
    defaultValues,
    onSubmit: (values) => acceptInvitation.mutateAsync({ ...values, token }),
  });

  return (
    <form.AppForm>
      <form.Form>
        <Field>
          <FieldLabel htmlFor={emailFieldId}>Email</FieldLabel>
          <Input id={emailFieldId} value={email} readOnly disabled />
        </Field>
        <form.AppField name="name">
          {(field) => <field.TextField {...fullNameField} />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField label="Password" {...newPasswordField} />
          )}
        </form.AppField>
        <form.SubmitButton className="w-full">Join workspace</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
};

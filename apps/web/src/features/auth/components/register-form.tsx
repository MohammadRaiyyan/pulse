import { type RegisterInput, registerSchema } from "@pulse/contracts";
import { useSchemaForm } from "@/components/form/app-form";
import {
  fullNameField,
  newPasswordField,
  signInEmailField,
} from "@/components/form/field-presets";
import { useRegister } from "../hooks/use-auth-mutations";

const defaultValues: RegisterInput = { name: "", email: "", password: "" };

export const RegisterForm = () => {
  const register = useRegister();
  const form = useSchemaForm({
    schema: registerSchema,
    defaultValues,
    onSubmit: register.mutateAsync,
  });

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="name">
          {(field) => <field.TextField {...fullNameField} />}
        </form.AppField>
        <form.AppField name="email">
          {(field) => <field.TextField {...signInEmailField} />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField label="Password" {...newPasswordField} />
          )}
        </form.AppField>
        <form.SubmitButton className="w-full">Create account</form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
};

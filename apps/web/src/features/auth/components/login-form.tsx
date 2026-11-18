import { type LoginInput, loginSchema } from "@pulse/contracts";
import { Link } from "@tanstack/react-router";
import { useSchemaForm } from "@/components/form/app-form";
import {
  currentPasswordField,
  signInEmailField,
} from "@/components/form/field-presets";
import { useLogin } from "../hooks/use-auth-mutations";
import { DemoAccounts } from "./demo-accounts";

const defaultValues: LoginInput = { email: "", password: "" };

export const LoginForm = () => {
  const login = useLogin();
  const form = useSchemaForm({
    schema: loginSchema,
    defaultValues,
    onSubmit: login.mutateAsync,
  });

  const fillCredentials = ({ email, password }: LoginInput) => {
    form.setFieldValue("email", email);
    form.setFieldValue("password", password);
  };

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="email">
          {(field) => <field.TextField {...signInEmailField} />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.TextField label="Password" {...currentPasswordField} />
          )}
        </form.AppField>
        <Link
          to="/forgot-password"
          className="-mt-3 self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
        <form.SubmitButton className="w-full">Sign in</form.SubmitButton>
        <DemoAccounts onSelect={fillCredentials} />
      </form.Form>
    </form.AppForm>
  );
};

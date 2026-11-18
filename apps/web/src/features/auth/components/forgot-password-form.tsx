import {
  type ForgotPasswordInput,
  forgotPasswordSchema,
} from "@pulse/contracts";
import { MailCheckIcon } from "lucide-react";
import { env } from "@/config/env";
import { useSchemaForm } from "@/components/form/app-form";
import { signInEmailField } from "@/components/form/field-presets";
import { useForgotPassword } from "../hooks/use-auth-mutations";

const defaultValues: ForgotPasswordInput = { email: "" };

const ResetLinkSent = ({ email }: { email: string }) => (
  <div className="flex flex-col items-center gap-3 py-2 text-center">
    <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
      <MailCheckIcon className="size-5" />
    </span>
    <p className="text-sm">
      If an account exists for <span className="font-medium">{email}</span>, a
      reset link is on its way.
    </p>
    {env.isApiMockingEnabled ? (
      <p className="font-mono text-xs text-muted-foreground">
        Mock API: the reset link is printed in the browser console.
      </p>
    ) : null}
  </div>
);

export const ForgotPasswordForm = () => {
  const forgotPassword = useForgotPassword();
  const form = useSchemaForm({
    schema: forgotPasswordSchema,
    defaultValues,
    onSubmit: forgotPassword.mutateAsync,
  });

  if (forgotPassword.isSuccess) {
    return <ResetLinkSent email={forgotPassword.variables.email} />;
  }

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name="email">
          {(field) => <field.TextField {...signInEmailField} />}
        </form.AppField>
        <form.SubmitButton className="w-full">
          Send reset link
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
};

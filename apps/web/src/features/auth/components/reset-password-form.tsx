import { resetPasswordSchema } from "@pulse/contracts";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSchemaForm } from "@/components/form/app-form";
import { NewPasswordFields } from "@/components/form/new-password-fields";
import {
  confirmPasswordShape,
  matchesConfirmation,
  passwordMismatchIssue,
  withoutConfirmation,
} from "@/lib/forms/password-confirmation";
import { useResetPassword } from "../hooks/use-auth-mutations";

const resetFormSchema = resetPasswordSchema
  .omit({ token: true })
  .extend(confirmPasswordShape)
  .refine(matchesConfirmation("password"), passwordMismatchIssue);

const defaultValues = { password: "", confirmPassword: "" };

export const ResetPasswordForm = ({ token }: { token: string }) => {
  const resetPassword = useResetPassword();
  const navigate = useNavigate();
  const form = useSchemaForm({
    schema: resetFormSchema,
    defaultValues,
    onSubmit: async (values) => {
      await resetPassword.mutateAsync({
        ...withoutConfirmation(values),
        token,
      });
      toast.success("Password updated. Sign in with your new password.", {
        description:
          "For your security, GitHub and Google sign-in were disconnected. Reconnect them in Settings.",
      });
      await navigate({ to: "/login" });
    },
  });

  return (
    <form.AppForm>
      <form.Form>
        <NewPasswordFields
          form={form}
          fields={{ password: "password", confirmPassword: "confirmPassword" }}
          confirmLabel="Confirm password"
        />
        <form.SubmitButton className="w-full">
          Update password
        </form.SubmitButton>
      </form.Form>
    </form.AppForm>
  );
};

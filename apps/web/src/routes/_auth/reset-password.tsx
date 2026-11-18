import { resetPasswordSchema } from "@pulse/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

const resetPasswordSearchSchema = resetPasswordSchema.pick({ token: true });

const ResetPasswordPage = () => {
  const { token } = Route.useSearch();

  return (
    <AuthCard
      title="Choose a new password"
      description="Pick something you have not used here before."
      footer={
        <AuthFooterLink
          prompt="Link expired?"
          to="/forgot-password"
          label="Request a new one"
        />
      }
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
};

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: resetPasswordSearchSchema,
  component: ResetPasswordPage,
});

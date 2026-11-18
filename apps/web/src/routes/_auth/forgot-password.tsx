import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

const ForgotPasswordPage = () => (
  <AuthCard
    title="Reset your password"
    description="Enter your email and we will send you a reset link."
    footer={
      <AuthFooterLink
        prompt="Remembered it?"
        to="/login"
        label="Back to sign in"
      />
    }
  >
    <ForgotPasswordForm />
  </AuthCard>
);

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordPage,
});

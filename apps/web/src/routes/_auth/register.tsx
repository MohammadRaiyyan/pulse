import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { RegisterForm } from "@/features/auth/components/register-form";
import { SocialSignIn } from "@/features/auth/components/social-sign-in";

const RegisterPage = () => (
  <AuthCard
    title="Create your account"
    description="Start monitoring endpoints in minutes."
    footer={
      <AuthFooterLink
        prompt="Already have an account?"
        to="/login"
        label="Sign in"
      />
    }
  >
    <SocialSignIn>
      <RegisterForm />
    </SocialSignIn>
  </AuthCard>
);

export const Route = createFileRoute("/_auth/register")({
  component: RegisterPage,
});

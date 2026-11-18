import { createFileRoute } from "@tanstack/react-router";
import { authSearchSchema } from "@/features/auth/auth-search";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { LoginForm } from "@/features/auth/components/login-form";
import { SocialSignIn } from "@/features/auth/components/social-sign-in";

const LoginPage = () => {
  const { redirect } = Route.useSearch();

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to monitor your APIs and webhooks."
      footer={
        <AuthFooterLink
          prompt="New to Pulse?"
          to="/register"
          label="Create an account"
        />
      }
    >
      <SocialSignIn redirectTo={redirect}>
        <LoginForm />
      </SocialSignIn>
    </AuthCard>
  );
};

export const Route = createFileRoute("/_auth/login")({
  validateSearch: authSearchSchema,
  component: LoginPage,
});

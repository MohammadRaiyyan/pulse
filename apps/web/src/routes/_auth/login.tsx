import { createFileRoute } from "@tanstack/react-router";
import { authSearchSchema } from "@/features/auth/auth-search";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { LoginForm } from "@/features/auth/components/login-form";
import { SocialSignIn } from "@/features/auth/components/social-sign-in";
import { useAuthConfig } from "@/features/auth/hooks/use-auth-config";

const LoginPage = () => {
  const { redirect } = Route.useSearch();
  const { signupOpen } = useAuthConfig();

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to monitor your APIs and webhooks."
      footer={
        signupOpen ? (
          <AuthFooterLink
            prompt="New to Pulse?"
            to="/register"
            label="Set up your workspace"
          />
        ) : (
          <p>Need an account? Ask a workspace admin for an invitation.</p>
        )
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

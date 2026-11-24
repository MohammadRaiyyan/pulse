import { createFileRoute } from "@tanstack/react-router";
import { AuthCard } from "@/features/auth/components/auth-card";
import { AuthFooterLink } from "@/features/auth/components/auth-footer-link";
import { InviteOnlyNotice } from "@/features/auth/components/invite-only-notice";
import { RegisterForm } from "@/features/auth/components/register-form";
import { SocialSignIn } from "@/features/auth/components/social-sign-in";
import { useAuthConfig } from "@/features/auth/hooks/use-auth-config";

const signInFooter = (
  <AuthFooterLink
    prompt="Already have an account?"
    to="/login"
    label="Sign in"
  />
);

const RegisterPage = () => {
  const { signupOpen } = useAuthConfig();

  if (!signupOpen) {
    return (
      <AuthCard
        title="Sign-up is invite-only"
        description="New accounts are created from an invitation."
        footer={signInFooter}
      >
        <InviteOnlyNotice />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set up your workspace"
      description="The first account becomes the workspace owner."
      footer={signInFooter}
    >
      <SocialSignIn>
        <RegisterForm />
      </SocialSignIn>
    </AuthCard>
  );
};

export const Route = createFileRoute("/_auth/register")({
  component: RegisterPage,
});

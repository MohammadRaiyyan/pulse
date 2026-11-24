import { verifyEmailSchema } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import {
  type ErrorComponentProps,
  Link,
  createFileRoute,
} from "@tanstack/react-router";
import { AuthErrorPage } from "@/app/shell/auth-error-page";
import { AuthShell } from "@/app/shell/auth-layout";
import { authApi } from "@/features/auth/api/auth-api";
import { AuthCard } from "@/features/auth/components/auth-card";
import { reloadSessionUser } from "@/features/auth/session";

const ContinueButton = () => (
  <Button className="w-full" asChild>
    <Link to="/">Continue to Pulse</Link>
  </Button>
);

const VerifiedPage = () => (
  <AuthShell>
    <AuthCard
      title="Email verified"
      description="Thanks for confirming your email address."
      footer={<p>You can close this tab if Pulse is open elsewhere.</p>}
    >
      <ContinueButton />
    </AuthCard>
  </AuthShell>
);

const VerifyErrorPage = ({ error }: ErrorComponentProps) => (
  <AuthErrorPage error={error}>
    <Button variant="ghost-accent" asChild>
      <Link to="/">Back to Pulse</Link>
    </Button>
  </AuthErrorPage>
);

export const Route = createFileRoute("/verify-email")({
  validateSearch: verifyEmailSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context: { queryClient }, deps }) => {
    await authApi.verifyEmail({ token: deps.token });
    await reloadSessionUser(queryClient);
  },
  component: VerifiedPage,
  errorComponent: VerifyErrorPage,
});

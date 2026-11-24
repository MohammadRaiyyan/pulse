import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/app/shell/auth-layout";
import { authConfigQuery } from "@/features/auth/api/auth-api";
import { redirectIfAuthenticated } from "@/features/auth/guards";

export const Route = createFileRoute("/_auth")({
  beforeLoad: redirectIfAuthenticated,
  loader: ({ context }) => context.queryClient.ensureQueryData(authConfigQuery),
  component: AuthLayout,
});

import { createFileRoute } from "@tanstack/react-router";
import { AuthLayout } from "@/app/shell/auth-layout";
import { redirectIfAuthenticated } from "@/features/auth/guards";

export const Route = createFileRoute("/_auth")({
  beforeLoad: redirectIfAuthenticated,
  component: AuthLayout,
});

import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/app/shell/app-layout";
import { requireUser } from "@/features/auth/guards";

export const Route = createFileRoute("/_app")({
  beforeLoad: requireUser,
  component: AppLayout,
});

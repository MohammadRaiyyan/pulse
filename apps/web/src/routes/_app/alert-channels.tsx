import { paginationQuerySchema } from "@pulse/contracts";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/alert-channels")({
  validateSearch: paginationQuerySchema,
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/integrations", search, replace: true });
  },
});

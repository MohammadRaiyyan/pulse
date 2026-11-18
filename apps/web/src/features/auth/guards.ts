import { type Permission, type User, hasPermission } from "@pulse/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { ApiError } from "@/lib/api/api-error";
import { authSearchSchema, toSafeRedirect } from "./auth-search";
import { sessionQueryOptions } from "./session";

type GuardOptions = {
  context: { queryClient: QueryClient };
  location: { href: string; search: unknown };
};

export const requireUser = async ({ context, location }: GuardOptions) => {
  const user = await context.queryClient.ensureQueryData(sessionQueryOptions);

  if (!user) {
    throw redirect({ to: "/login", search: { redirect: location.href } });
  }

  return { user };
};

export const redirectIfAuthenticated = async ({
  context,
  location,
}: GuardOptions) => {
  const user = await context.queryClient.ensureQueryData(sessionQueryOptions);

  if (user) {
    const { redirect: target } = authSearchSchema.parse(location.search);
    throw redirect({ href: toSafeRedirect(target) });
  }
};

const requirePermission = (user: User, permission: Permission) => {
  if (!hasPermission(user.role, permission)) {
    throw new ApiError({
      status: 403,
      code: "FORBIDDEN",
      message: "Your role does not include access to this page.",
    });
  }
};

export const guard =
  (permission: Permission) =>
  ({ context }: { context: { user: User } }) =>
    requirePermission(context.user, permission);

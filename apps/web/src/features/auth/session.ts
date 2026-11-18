import type { User } from "@pulse/contracts";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import { clearAccessToken } from "@/lib/api/access-token";
import { hasErrorCode } from "@/lib/api/api-error";
import { refreshSession } from "@/lib/api/refresh-session";

const sessionQueryKey = ["session"] as const;

const restoreSession = async () => {
  try {
    return await refreshSession();
  } catch (error) {
    if (hasErrorCode(error, "UNAUTHORIZED")) {
      return null;
    }

    throw error;
  }
};

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: restoreSession,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
  retry: false,
});

type SessionContext = {
  queryClient: QueryClient;
  router: AnyRouter;
};

export const setSessionUser = (queryClient: QueryClient, user: User) =>
  queryClient.setQueryData(sessionQueryKey, user);

export const startSession = async (
  { queryClient, router }: SessionContext,
  user: User,
) => {
  setSessionUser(queryClient, user);
  await router.invalidate();
};

export const endSession = async (
  { queryClient, router }: SessionContext,
  returnTo?: string,
) => {
  clearAccessToken();
  queryClient.setQueryData(sessionQueryKey, null);
  await router.navigate({ to: "/login", search: { redirect: returnTo } });
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
  });
};

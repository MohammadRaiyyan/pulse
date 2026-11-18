import type { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { NotFoundState } from "@/components/feedback/not-found-state";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { RouteErrorState } from "@/components/feedback/route-error-state";
import { routeTree } from "@/routeTree.gen";

export type RouterContext = {
  queryClient: QueryClient;
};

export const createAppRouter = (queryClient: QueryClient) =>
  createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: PageSkeleton,
    defaultErrorComponent: RouteErrorState,
    defaultNotFoundComponent: NotFoundState,
    scrollRestoration: true,
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

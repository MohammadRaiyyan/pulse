import { getRouteApi } from "@tanstack/react-router";

const appRoute = getRouteApi("/_app");

export const useCurrentUser = () =>
  appRoute.useRouteContext({ select: (context) => context.user });

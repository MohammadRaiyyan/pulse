import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";
import { Devtools } from "@/app/devtools";
import type { RouterContext } from "@/app/router";
import { NavigationProgress } from "@/components/feedback/navigation-progress";

const RootLayout = () => (
  <>
    <NavigationProgress />
    <Outlet />
    <Devtools />
  </>
);

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
});

import "@pulse/ui/globals.css";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { enableApiMocking } from "@/app/enable-api-mocking";
import { AppProviders } from "@/app/providers";
import { createAppRouter } from "@/app/router";
import { BootScreen } from "@/components/feedback/boot-screen";
import { endSession } from "@/features/auth/session";
import { onSessionExpired } from "@/lib/api/session-events";
import { createQueryClient } from "@/lib/query/query-client";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root is missing from index.html");
}

const root = createRoot(rootElement);
root.render(<BootScreen />);

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

onSessionExpired(() =>
  endSession({ queryClient, router }, router.state.location.href),
);

await enableApiMocking();
await router.load();

root.render(
  <StrictMode>
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);

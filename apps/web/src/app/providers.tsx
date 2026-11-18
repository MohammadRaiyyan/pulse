import { Toaster } from "@pulse/ui/components/sonner";
import { ThemeProvider } from "@pulse/ui/components/theme-provider";
import { TooltipProvider } from "@pulse/ui/components/tooltip";
import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

type AppProvidersProps = {
  queryClient: QueryClient;
  children: ReactNode;
};

export const AppProviders = ({ queryClient, children }: AppProvidersProps) => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        {children}
        <Toaster richColors closeButton />
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

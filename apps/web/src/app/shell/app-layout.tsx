import { SidebarInset, SidebarProvider } from "@pulse/ui/components/sidebar";
import { Outlet } from "@tanstack/react-router";
import { EmailVerificationBanner } from "@/features/account/components/email-verification-banner";
import { useLiveUpdates } from "@/features/live-updates/hooks/use-live-updates";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export const AppLayout = () => {
  const liveStatus = useLiveUpdates();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader liveStatus={liveStatus} />
        <EmailVerificationBanner />
        <div className="flex-1 p-4 md:p-6">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

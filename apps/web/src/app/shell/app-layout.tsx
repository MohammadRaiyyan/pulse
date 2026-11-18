import { SidebarInset, SidebarProvider } from "@pulse/ui/components/sidebar";
import { Outlet } from "@tanstack/react-router";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

export const AppLayout = () => (
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <AppHeader />
      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </SidebarInset>
  </SidebarProvider>
);

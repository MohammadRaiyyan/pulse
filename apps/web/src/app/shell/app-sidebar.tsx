import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "@pulse/ui/components/sidebar";
import { Brand } from "@/components/brand/brand";
import { NavMain } from "./nav-main";
import { UserMenu } from "./user-menu";

export const AppSidebar = () => (
  <Sidebar
    collapsible="icon"
    className="**:data-[sidebar=sidebar]:bg-linear-to-b **:data-[sidebar=sidebar]:from-sidebar-highlight **:data-[sidebar=sidebar]:to-sidebar"
  >
    <SidebarHeader className="h-14 justify-center text-sidebar-accent-foreground group-data-[collapsible=icon]:items-center">
      <Brand />
    </SidebarHeader>
    <SidebarContent className="gap-0 pt-2">
      <NavMain />
    </SidebarContent>
    <SidebarFooter>
      <UserMenu />
    </SidebarFooter>
  </Sidebar>
);

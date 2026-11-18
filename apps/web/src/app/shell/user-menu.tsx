import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@pulse/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@pulse/ui/components/sidebar";
import { Link } from "@tanstack/react-router";
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import { useLogout } from "@/features/auth/hooks/use-auth-mutations";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { RoleBadge } from "@/features/team/components/role-badge";
import { UserAvatar } from "@/components/data/user-avatar";

export const UserMenu = () => {
  const user = useCurrentUser();
  const logout = useLogout();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-open:bg-sidebar-accent"
            >
              <UserAvatar name={user.name} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium text-sidebar-accent-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="min-w-56">
            <DropdownMenuLabel className="flex items-center justify-between gap-2">
              Signed in as
              <RoleBadge value={user.role} />
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <SettingsIcon />
                Account settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={logout.isPending}
              onSelect={() => logout.mutate()}
            >
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

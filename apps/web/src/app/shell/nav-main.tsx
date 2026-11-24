import { hasPermission } from "@pulse/contracts";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@pulse/ui/components/sidebar";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { type NavItem, navItems } from "./nav-items";

const activeIndicator =
  "relative [&_svg]:size-[18px] data-active:bg-sidebar-primary/14 data-active:hover:bg-sidebar-primary/20 data-active:before:absolute data-active:before:inset-y-1.5 data-active:before:-left-2 data-active:before:w-1 data-active:before:rounded-r-full data-active:before:bg-sidebar-primary data-active:[&>svg]:text-sidebar-primary";

const NavLink = ({ item }: { item: NavItem }) => {
  const matchRoute = useMatchRoute();
  const isActive = Boolean(matchRoute({ to: item.to, fuzzy: item.to !== "/" }));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={item.title}
        className={activeIndicator}
      >
        <Link to={item.to}>
          <item.icon />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
      {item.badge ? <item.badge /> : null}
    </SidebarMenuItem>
  );
};

export const NavMain = () => {
  const { role } = useCurrentUser();
  const visibleItems = navItems.filter((item) =>
    hasPermission(role, item.permission),
  );

  return (
    <nav aria-label="Main">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu className="gap-0.5">
            {visibleItems.map((item) => (
              <NavLink key={item.title} item={item} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
};

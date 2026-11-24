import type { Permission } from "@pulse/contracts";
import type { LinkProps } from "@tanstack/react-router";
import {
  ActivityIcon,
  ChartColumnIcon,
  GlobeIcon,
  LayersIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PlugIcon,
  SirenIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { ActiveIncidentsBadge } from "@/features/dashboard/components/active-incidents-badge";

export type NavItem = {
  title: string;
  to: LinkProps["to"];
  icon: LucideIcon;
  permission: Permission;
  badge?: ComponentType;
};

export const navItems: readonly NavItem[] = [
  {
    title: "Dashboard",
    to: "/",
    icon: LayoutDashboardIcon,
    permission: "monitor:read",
  },
  {
    title: "Monitors",
    to: "/monitors",
    icon: ActivityIcon,
    permission: "monitor:read",
  },
  {
    title: "Services",
    to: "/services",
    icon: LayersIcon,
    permission: "monitor:read",
  },
  {
    title: "Webhooks",
    to: "/webhooks",
    icon: WebhookIcon,
    permission: "webhook:read",
  },
  {
    title: "Incidents",
    to: "/incidents",
    icon: SirenIcon,
    permission: "incident:read",
    badge: ActiveIncidentsBadge,
  },
  {
    title: "Reports",
    to: "/reports",
    icon: ChartColumnIcon,
    permission: "monitor:read",
  },
  {
    title: "Integrations",
    to: "/integrations",
    icon: PlugIcon,
    permission: "alert-channel:read",
  },
  { title: "Team", to: "/team", icon: UsersIcon, permission: "member:read" },
  {
    title: "Status page",
    to: "/status-page",
    icon: GlobeIcon,
    permission: "status-page:manage",
  },
];

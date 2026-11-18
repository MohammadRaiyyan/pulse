import type { Permission } from "@pulse/contracts";
import type { LinkProps } from "@tanstack/react-router";
import {
  ActivityIcon,
  BellRingIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  SirenIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { OpenIncidentsBadge } from "@/features/dashboard/components/open-incidents-badge";

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
    badge: OpenIncidentsBadge,
  },
  {
    title: "Alert channels",
    to: "/alert-channels",
    icon: BellRingIcon,
    permission: "alert-channel:read",
  },
  { title: "Team", to: "/team", icon: UsersIcon, permission: "member:read" },
];

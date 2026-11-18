import { type Role, assignableRoleSchema } from "@pulse/contracts";
import { CrownIcon, EyeIcon, ShieldCheckIcon, UserIcon } from "lucide-react";
import type { StatusMeta } from "@/components/data/tones";
import { metaOptions } from "@/lib/options";

export const roleMeta: Record<Role, StatusMeta> = {
  owner: { label: "Owner", tone: "info", icon: CrownIcon },
  admin: { label: "Admin", tone: "warning", icon: ShieldCheckIcon },
  member: { label: "Member", tone: "success", icon: UserIcon },
  viewer: { label: "Viewer", tone: "neutral", icon: EyeIcon },
};

export const assignableRoleOptions = metaOptions(
  assignableRoleSchema.options,
  roleMeta,
);

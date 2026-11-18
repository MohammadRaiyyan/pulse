import { z } from "zod";
import type { Role } from "./roles.ts";

export const permissionSchema = z.enum([
  "monitor:read",
  "monitor:write",
  "webhook:read",
  "webhook:write",
  "alert-channel:read",
  "alert-channel:write",
  "incident:read",
  "incident:manage",
  "member:read",
  "member:manage",
]);

export type Permission = z.infer<typeof permissionSchema>;

const allPermissions = permissionSchema.options;

const readPermissions = allPermissions.filter((permission) =>
  permission.endsWith(":read"),
);

export const rolePermissions: Record<Role, readonly Permission[]> = {
  owner: allPermissions,
  admin: allPermissions,
  member: [
    ...readPermissions,
    "monitor:write",
    "webhook:write",
    "incident:manage",
  ],
  viewer: readPermissions,
};

export const hasPermission = (role: Role, permission: Permission) =>
  rolePermissions[role].includes(permission);

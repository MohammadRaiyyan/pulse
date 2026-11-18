import { type Permission, hasPermission } from "@pulse/contracts";
import { useCurrentUser } from "./use-current-user";

export const useCan = (permission: Permission) =>
  hasPermission(useCurrentUser().role, permission);

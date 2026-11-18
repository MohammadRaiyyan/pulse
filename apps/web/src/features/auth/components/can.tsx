import type { Permission } from "@pulse/contracts";
import type { ReactNode } from "react";
import { useCan } from "../hooks/use-can";

type CanProps = {
  permission: Permission;
  children: ReactNode;
};

export const Can = ({ permission, children }: CanProps) =>
  useCan(permission) ? children : null;

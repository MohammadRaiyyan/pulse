import { cn } from "@pulse/ui/lib/utils";
import type { ComponentProps } from "react";

export const TableAnchor = ({
  className,
  children,
  ...props
}: ComponentProps<"a">) => (
  <a {...props} className={cn("font-medium hover:underline", className)}>
    {children}
  </a>
);

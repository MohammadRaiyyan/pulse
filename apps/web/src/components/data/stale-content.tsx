import { cn } from "@pulse/ui/lib/utils";
import type { ReactNode } from "react";

type StaleContentProps = {
  isStale: boolean;
  children: ReactNode;
};

export const StaleContent = ({ isStale, children }: StaleContentProps) => (
  <div
    aria-busy={isStale}
    className={cn(
      "flex flex-col gap-4 transition-opacity",
      isStale && "opacity-60",
    )}
  >
    {children}
  </div>
);

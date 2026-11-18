import { Skeleton } from "@pulse/ui/components/skeleton";
import { cn } from "@pulse/ui/lib/utils";

export const ControlSkeleton = ({ className }: { className?: string }) => (
  <Skeleton className={cn("h-9 w-28 rounded-md", className)} />
);

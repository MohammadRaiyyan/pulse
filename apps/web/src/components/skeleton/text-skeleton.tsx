import { Skeleton } from "@pulse/ui/components/skeleton";
import { cn } from "@pulse/ui/lib/utils";

export const TextSkeleton = ({ className }: { className?: string }) => (
  <Skeleton className={cn("h-4 w-24 rounded-sm", className)} />
);

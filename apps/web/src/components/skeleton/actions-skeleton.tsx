import { cn } from "@pulse/ui/lib/utils";
import { ControlSkeleton } from "./control-skeleton";

type ActionsSkeletonProps = {
  count: number;
  iconOnly?: boolean;
};

export const ActionsSkeleton = ({
  count,
  iconOnly = false,
}: ActionsSkeletonProps) => (
  <div className="flex justify-end gap-1">
    {Array.from({ length: count }, (_, index) => (
      <ControlSkeleton key={index} className={cn(iconOnly ? "w-9" : "w-24")} />
    ))}
  </div>
);

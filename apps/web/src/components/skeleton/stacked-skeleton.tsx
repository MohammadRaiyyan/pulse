import { Skeleton } from "@pulse/ui/components/skeleton";
import { TextSkeleton } from "./text-skeleton";

type StackedSkeletonProps = {
  withMedia?: boolean;
};

export const StackedSkeleton = ({
  withMedia = false,
}: StackedSkeletonProps) => (
  <div className="flex items-center gap-3">
    {withMedia ? <Skeleton className="size-8 shrink-0 rounded-lg" /> : null}
    <div className="flex flex-col gap-1.5">
      <TextSkeleton className="w-32" />
      <TextSkeleton className="h-3 w-48" />
    </div>
  </div>
);

import { Skeleton } from "@pulse/ui/components/skeleton";

export const ChartAreaSkeleton = () => (
  <Skeleton className="h-64 w-full rounded-md" />
);

export const ChartSkeleton = () => (
  <>
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-full rounded-md" />
      <Skeleton className="h-4 w-full rounded-sm" />
    </div>
    <ChartAreaSkeleton />
  </>
);

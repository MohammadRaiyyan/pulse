import { TableSkeletonCard } from "./table-skeleton-card";
import { TitleSkeleton } from "@/components/skeleton/title-skeleton";

export const PageSkeleton = () => (
  <div className="flex w-full flex-col gap-4" aria-busy aria-label="Loading">
    <div className="flex min-h-9 items-center">
      <TitleSkeleton />
    </div>
    <TableSkeletonCard />
  </div>
);

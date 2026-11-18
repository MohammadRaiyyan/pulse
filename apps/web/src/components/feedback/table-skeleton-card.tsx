import { Skeleton } from "@pulse/ui/components/skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";

const ROWS = 5;

export const TableSkeletonCard = () => (
  <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
    <div className="flex flex-col gap-1.5">
      <TextSkeleton className="h-5 w-32" />
      <TextSkeleton className="w-64" />
    </div>
    <div className="flex flex-col">
      <Skeleton className="h-9 w-full rounded-t-md rounded-b-none" />
      {Array.from({ length: ROWS }, (_, index) => (
        <div key={index} className="flex h-12 items-center border-b">
          <TextSkeleton className="w-1/3" />
        </div>
      ))}
    </div>
  </section>
);

import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@pulse/ui/components/skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { StatCard } from "./stat-card";
import { StatGrid } from "./stat-grid";
import type { StatusTone } from "./tones";

export type StatDefinition<TData> = {
  label: string;
  icon: LucideIcon;
  value: (data: TData) => string;
  tone?: (data: TData) => StatusTone;
  hint?: (data: TData) => string;
};

type StatCardsProps<TData> = {
  definitions: readonly StatDefinition<TData>[];
  data: TData;
};

export const StatCards = <TData,>({
  definitions,
  data,
}: StatCardsProps<TData>) => (
  <StatGrid>
    {definitions.map((definition) => (
      <StatCard
        key={definition.label}
        label={definition.label}
        icon={definition.icon}
        tone={definition.tone?.(data)}
        value={definition.value(data)}
        hint={definition.hint?.(data)}
      />
    ))}
  </StatGrid>
);

type StatCardsSkeletonProps<TData> = {
  definitions: readonly StatDefinition<TData>[];
};

export const StatCardsSkeleton = <TData,>({
  definitions,
}: StatCardsSkeletonProps<TData>) => (
  <StatGrid>
    {definitions.map((definition) => (
      <StatCard
        key={definition.label}
        label={definition.label}
        icon={definition.icon}
        value={<Skeleton className="h-[26px] w-24 rounded-sm" />}
        hint={
          definition.hint ? <TextSkeleton className="h-3 w-36" /> : undefined
        }
      />
    ))}
  </StatGrid>
);

import type { ReactNode } from "react";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";

export type DetailDefinition<TData> = {
  label: string;
  value: (data: TData) => ReactNode;
};

type DetailRowsProps = {
  rows: ReadonlyArray<{ label: string; value: ReactNode }>;
};

const DetailRows = ({ rows }: DetailRowsProps) => (
  <dl className="grid gap-4 sm:grid-cols-2">
    {rows.map((row) => (
      <div key={row.label} className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">{row.label}</dt>
        <dd className="text-sm font-medium break-all">{row.value}</dd>
      </div>
    ))}
  </dl>
);

type DetailListProps<TData> = {
  definitions: readonly DetailDefinition<TData>[];
  data: TData;
};

export const DetailList = <TData,>({
  definitions,
  data,
}: DetailListProps<TData>) => (
  <DetailRows
    rows={definitions.map(({ label, value }) => ({
      label,
      value: value(data),
    }))}
  />
);

type DetailListSkeletonProps<TData> = {
  definitions: readonly DetailDefinition<TData>[];
};

export const DetailListSkeleton = <TData,>({
  definitions,
}: DetailListSkeletonProps<TData>) => (
  <DetailRows
    rows={definitions.map(({ label }) => ({
      label,
      value: <TextSkeleton className="w-40" />,
    }))}
  />
);

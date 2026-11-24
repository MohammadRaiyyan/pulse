import {
  type AlertChannelType,
  alertChannelTypeSchema,
} from "@pulse/contracts";
import { Skeleton } from "@pulse/ui/components/skeleton";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { channelTypeMeta } from "../alert-channel-meta";
import { alertChannelCountsQuery } from "../api/alert-channel-resource";
import { ConnectProviderButton } from "./connect-provider-button";

const GRID = "grid gap-3 sm:grid-cols-2 xl:grid-cols-4";

const connectedLabel = (count: number) =>
  count === 0 ? "Not connected" : `${count} connected`;

const ProviderCard = ({
  type,
  count,
}: {
  type: AlertChannelType;
  count: number;
}) => {
  const { icon: Icon, label, description } = channelTypeMeta[type];
  const titleId = `provider-${type}`;

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h3 id={titleId} className="truncate font-medium">
            {label}
          </h3>
          <span className="text-xs text-muted-foreground">
            {connectedLabel(count)}
          </span>
        </div>
      </div>
      <p className="flex-1 text-sm text-muted-foreground">{description}</p>
      <div>
        <ConnectProviderButton type={type} />
      </div>
    </article>
  );
};

const CatalogGrid = () => {
  const { data: counts } = useSuspenseQuery(alertChannelCountsQuery);

  return (
    <div className={GRID}>
      {alertChannelTypeSchema.options.map((type) => (
        <ProviderCard key={type} type={type} count={counts.get(type) ?? 0} />
      ))}
    </div>
  );
};

const CatalogSkeleton = () => (
  <div className={GRID}>
    {alertChannelTypeSchema.options.map((type) => (
      <div
        key={type}
        className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-lg" />
          <TextSkeleton className="w-28" />
        </div>
        <TextSkeleton className="w-full" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
    ))}
  </div>
);

export const IntegrationCatalog = () => (
  <Suspense fallback={<CatalogSkeleton />}>
    <CatalogGrid />
  </Suspense>
);

import type { Paginated } from "@pulse/contracts";
import {
  type QueryKey,
  type UseSuspenseQueryOptions,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { type ReactNode, Suspense, useDeferredValue } from "react";
import { PaginationControls } from "./pagination-controls";
import { StaleContent } from "./stale-content";

type PagedQueryViewProps<TParams, TItem, TQueryKey extends QueryKey> = {
  params: TParams;
  query: (
    params: TParams,
  ) => UseSuspenseQueryOptions<
    Paginated<TItem>,
    Error,
    Paginated<TItem>,
    TQueryKey
  >;
  children: (items: readonly TItem[], page: Paginated<TItem>) => ReactNode;
};

type PagedQueryViewWithFallbackProps<
  TParams,
  TItem,
  TQueryKey extends QueryKey,
> = PagedQueryViewProps<TParams, TItem, TQueryKey> & {
  fallback: ReactNode;
};

const PagedQueryContent = <TParams, TItem, TQueryKey extends QueryKey>({
  params,
  query,
  children,
}: PagedQueryViewProps<TParams, TItem, TQueryKey>) => {
  const deferredParams = useDeferredValue(params);
  const { data } = useSuspenseQuery(query(deferredParams));

  return (
    <StaleContent isStale={deferredParams !== params}>
      {children(data.items, data)}
      <PaginationControls
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
      />
    </StaleContent>
  );
};

export const PagedQueryView = <TParams, TItem, TQueryKey extends QueryKey>({
  fallback,
  ...props
}: PagedQueryViewWithFallbackProps<TParams, TItem, TQueryKey>) => (
  <Suspense fallback={fallback}>
    <PagedQueryContent {...props} />
  </Suspense>
);

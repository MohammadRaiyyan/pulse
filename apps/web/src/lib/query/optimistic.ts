import type { Paginated } from "@pulse/contracts";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { QueryKeys } from "./query-keys";

type Identifiable = { id: string };

type CacheSnapshot = ReadonlyArray<[QueryKey, unknown]>;

export const patchCachedItem = async <TItem extends Identifiable>(
  queryClient: QueryClient,
  keys: QueryKeys,
  id: string,
  patch: (item: TItem) => TItem,
): Promise<CacheSnapshot> => {
  await queryClient.cancelQueries({ queryKey: keys.all });
  const snapshot = queryClient.getQueriesData({ queryKey: keys.all });

  queryClient.setQueriesData<Paginated<TItem>>(
    { queryKey: keys.lists() },
    (page) =>
      page
        ? {
            ...page,
            items: page.items.map((item) =>
              item.id === id ? patch(item) : item,
            ),
          }
        : page,
  );
  queryClient.setQueryData<TItem>(keys.detail(id), (item) =>
    item ? patch(item) : item,
  );

  return snapshot;
};

export const restoreSnapshot = (
  queryClient: QueryClient,
  snapshot: CacheSnapshot | undefined,
) => snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));

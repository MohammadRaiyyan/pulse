import type { Paginated, PaginationQuery } from "@pulse/contracts";

export const paginate = <TItem>(
  items: readonly TItem[],
  { page, pageSize }: PaginationQuery,
): Paginated<TItem> => ({
  items: items.slice((page - 1) * pageSize, page * pageSize),
  page,
  pageSize,
  total: items.length,
});

import type { Paginated, PaginationQuery } from "@pulse/contracts";

export const toLimitOffset = ({ page, pageSize }: PaginationQuery) => ({
  limit: pageSize,
  offset: (page - 1) * pageSize,
});

export const toPage = <TItem>(
  items: TItem[],
  total: number,
  { page, pageSize }: PaginationQuery,
): Paginated<TItem> => ({
  items,
  page,
  pageSize,
  total,
});

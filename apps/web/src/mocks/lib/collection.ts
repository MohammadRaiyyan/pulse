import type { PathParams } from "msw";
import { getParam } from "./request";
import { notFound } from "./responses";

export type Identifiable = { id: string };

export const newestFirst = <TItem>(
  items: Iterable<TItem>,
  getDate: (item: TItem) => string,
) =>
  [...items].toSorted((left, right) =>
    getDate(right).localeCompare(getDate(left)),
  );

export const findById = <TItem>(
  store: ReadonlyMap<string, TItem>,
  params: PathParams,
  label: string,
) => {
  const item = store.get(getParam(params, "id"));

  if (!item) {
    throw notFound(label);
  }

  return item;
};

export const matchesStatus = <TStatus>(
  item: { status: TStatus },
  query: { status?: TStatus },
) => query.status === undefined || item.status === query.status;

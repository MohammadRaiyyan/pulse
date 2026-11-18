import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import {
  type ListQueryOf,
  type ResourceSchemas,
  createCrudApi,
} from "@/lib/api/crud-api";
import { type QueryKeys, createQueryKeys } from "./query-keys";

export const createResource = <
  TItem extends z.ZodType,
  TListQuery extends z.ZodType,
  TCreate extends z.ZodType = z.ZodNever,
  TUpdate extends z.ZodType = z.ZodNever,
>(
  definition: ResourceSchemas<TItem, TListQuery, TCreate, TUpdate>,
  label: string,
) => {
  const keys = createQueryKeys(definition.path);
  const api = createCrudApi(definition);

  return {
    label,
    definition,
    keys,
    api,
    queries: {
      list: (query: ListQueryOf<TListQuery>) =>
        queryOptions({
          queryKey: keys.list(query),
          queryFn: () => api.list(query),
        }),
      detail: (id: string) =>
        queryOptions({
          queryKey: keys.detail(id),
          queryFn: () => api.get(id),
        }),
    },
  };
};

export type AnyResource<TItem = unknown, TCreate = never, TUpdate = never> = {
  label: string;
  keys: QueryKeys;
  api: {
    create(input: TCreate): Promise<TItem>;
    update(id: string, input: TUpdate): Promise<TItem>;
    remove(id: string): Promise<unknown>;
  };
};

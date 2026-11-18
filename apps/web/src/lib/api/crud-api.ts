import {
  type ResourceDefinition,
  buildPath,
  itemPath,
  paginatedSchema,
} from "@pulse/contracts";
import type { z } from "zod";
import { emptyResponseSchema, http } from "./http-client";

export type ResourceSchemas<
  TItem extends z.ZodType,
  TListQuery extends z.ZodType,
  TCreate extends z.ZodType,
  TUpdate extends z.ZodType,
> = Omit<ResourceDefinition, "item" | "listQuery" | "create" | "update"> & {
  item: TItem;
  listQuery: TListQuery;
  create?: TCreate;
  update?: TUpdate;
};

export type ListQueryOf<TListQuery extends z.ZodType> = z.output<TListQuery> &
  object;

export const createCrudApi = <
  TItem extends z.ZodType,
  TListQuery extends z.ZodType,
  TCreate extends z.ZodType,
  TUpdate extends z.ZodType,
>(
  definition: ResourceSchemas<TItem, TListQuery, TCreate, TUpdate>,
) => {
  const listSchema = paginatedSchema(definition.item);
  const pathTo = (id: string) => buildPath(itemPath(definition), { id });

  return {
    list: (query: ListQueryOf<TListQuery>) =>
      http("GET", definition.path, { query, schema: listSchema }),
    get: (id: string) => http("GET", pathTo(id), { schema: definition.item }),
    create: (input: z.input<TCreate>) =>
      http("POST", definition.path, {
        body: input,
        schema: definition.item,
      }),
    update: (id: string, input: z.input<TUpdate>) =>
      http("PATCH", pathTo(id), { body: input, schema: definition.item }),
    remove: (id: string) =>
      http("DELETE", pathTo(id), { schema: emptyResponseSchema }),
  };
};

import {
  type PaginationQuery,
  type Permission,
  type User,
  defineEndpoint,
  itemPath,
  paginatedSchema,
} from "@pulse/contracts";
import type { z } from "zod";
import { type Identifiable, findById, newestFirst } from "./collection";
import { paginate } from "./paginate";
import { route } from "./route";
import { noContent } from "./responses";

type CrudResource<TItem, TQuery, TCreate, TUpdate> = {
  path: string;
  permissions: { read: Permission; write: Permission };
  item: z.ZodType<TItem>;
  listQuery: z.ZodType<TQuery>;
  create?: z.ZodType<TCreate>;
  update?: z.ZodType<TUpdate>;
};

type CrudOptions<TItem, TQuery, TCreate, TUpdate> = {
  label: string;
  store: Map<string, TItem>;
  sortKey: (item: TItem) => string;
  matches?: (item: TItem, query: TQuery) => boolean;
  present?: (item: TItem) => TItem;
  toItem?: (input: TCreate, user: User) => TItem;
  applyUpdate?: (item: TItem, input: TUpdate, user: User) => TItem;
  onUpdate?: (item: TItem) => void;
  onDelete?: (item: TItem, user: User) => void;
};

export const crudHandlers = <
  TItem extends Identifiable,
  TQuery extends PaginationQuery,
  TCreate,
  TUpdate,
>(
  resource: CrudResource<TItem, TQuery, TCreate, TUpdate>,
  {
    label,
    store,
    sortKey,
    matches = () => true,
    present = (item) => item,
    toItem,
    applyUpdate,
    onUpdate,
    onDelete,
  }: CrudOptions<TItem, TQuery, TCreate, TUpdate>,
) => {
  const { path, permissions, item, listQuery, create, update } = resource;
  const detailPath = itemPath(resource);

  const save = (saved: TItem) => {
    store.set(saved.id, saved);

    return present(saved);
  };

  const list = route(
    defineEndpoint({
      method: "GET",
      path,
      access: permissions.read,
      query: listQuery,
      response: paginatedSchema(item),
    }),
    ({ query, respond }) =>
      respond(
        paginate(
          newestFirst(store.values(), sortKey)
            .map(present)
            .filter((entry) => matches(entry, query)),
          query,
        ),
      ),
  );

  const detail = route(
    defineEndpoint({
      method: "GET",
      path: detailPath,
      access: permissions.read,
      response: item,
    }),
    ({ params, respond }) => respond(present(findById(store, params, label))),
  );

  const createRoute =
    create &&
    toItem &&
    route(
      defineEndpoint({
        method: "POST",
        path,
        access: permissions.write,
        body: create,
        response: item,
      }),
      ({ body, user, respond }) =>
        respond(save(toItem(body, user)), { status: 201 }),
    );

  const updateRoute =
    update &&
    applyUpdate &&
    route(
      defineEndpoint({
        method: "PATCH",
        path: detailPath,
        access: permissions.write,
        body: update,
        response: item,
      }),
      ({ params, body, user, respond }) => {
        const updated = save(
          applyUpdate(findById(store, params, label), body, user),
        );
        onUpdate?.(updated);

        return respond(updated);
      },
    );

  const deleteRoute =
    onDelete &&
    route(
      defineEndpoint({
        method: "DELETE",
        path: detailPath,
        access: permissions.write,
      }),
      ({ params, user }) => {
        const existing = findById(store, params, label);
        onDelete(existing, user);
        store.delete(existing.id);

        return noContent();
      },
    );

  return [list, detail, createRoute, updateRoute, deleteRoute].filter(
    (handler) => handler !== undefined,
  );
};

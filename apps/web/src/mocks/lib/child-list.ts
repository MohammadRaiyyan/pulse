import type {
  EndpointDefinition,
  PaginationQuery,
  Permission,
} from "@pulse/contracts";
import type { z } from "zod";
import { type Identifiable, findById, newestFirst } from "./collection";
import { paginate } from "./paginate";
import { route } from "./route";

type ChildListEndpoint = EndpointDefinition & {
  access: Permission;
  query: z.ZodType<PaginationQuery>;
  response: z.ZodType;
};

type ChildListOptions<TParent, TChild> = {
  label: string;
  parents: ReadonlyMap<string, TParent>;
  children: ReadonlyMap<string, readonly TChild[]>;
  sortKey: (child: TChild) => string;
};

export const childListHandler = <TParent extends Identifiable, TChild>(
  endpoint: ChildListEndpoint,
  { label, parents, children, sortKey }: ChildListOptions<TParent, TChild>,
) =>
  route(endpoint, ({ params, query, respond }) => {
    const parent = findById(parents, params, label);

    return respond(
      paginate(newestFirst(children.get(parent.id) ?? [], sortKey), query),
    );
  });

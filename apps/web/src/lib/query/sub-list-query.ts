import type { EndpointDefinition, PaginationQuery } from "@pulse/contracts";
import { queryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import { requestEndpoint } from "@/lib/api/call-endpoint";
import type { QueryKeys } from "./query-keys";

type SubListEndpoint<TResponse extends z.ZodType> = EndpointDefinition & {
  response: TResponse;
};

export const createSubListQuery =
  <TResponse extends z.ZodType>(
    keys: QueryKeys,
    endpoint: SubListEndpoint<TResponse>,
    name: string,
  ) =>
  (id: string, query: PaginationQuery) =>
    queryOptions({
      queryKey: [...keys.detail(id), name, query],
      queryFn: () =>
        requestEndpoint(endpoint, endpoint.response, {
          params: { id },
          query,
        }),
    });

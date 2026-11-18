import { type EndpointDefinition, buildPath } from "@pulse/contracts";
import type { z } from "zod";
import { emptyResponseSchema, http, publicHttp } from "./http-client";

type PathParams<TPath extends string> =
  TPath extends `${string}:${infer Param}/${infer Rest}`
    ? Param | PathParams<`/${Rest}`>
    : TPath extends `${string}:${infer Param}`
      ? Param
      : never;

type NoArgs = Record<never, never>;

type ParamsArgs<TPath extends string> = [PathParams<TPath>] extends [never]
  ? NoArgs
  : { params: Record<PathParams<TPath>, string> };

type SchemaArgs<TEndpoint, TKey extends "body" | "query"> =
  TEndpoint extends Record<TKey, infer TSchema extends z.ZodType>
    ? Record<TKey, z.input<TSchema>>
    : NoArgs;

type EndpointRequest = {
  params?: Record<string, string>;
  query?: object;
  body?: unknown;
};

type EndpointArgs<TEndpoint extends EndpointDefinition> = EndpointRequest &
  ParamsArgs<TEndpoint["path"]> &
  SchemaArgs<TEndpoint, "body"> &
  SchemaArgs<TEndpoint, "query">;

type EndpointArgsTuple<TEndpoint extends EndpointDefinition> =
  NoArgs extends EndpointArgs<TEndpoint>
    ? [args?: EndpointArgs<TEndpoint>]
    : [args: EndpointArgs<TEndpoint>];

type EndpointResponse<TEndpoint> = TEndpoint extends {
  response: infer TSchema extends z.ZodType;
}
  ? z.output<TSchema>
  : undefined;

export const requestEndpoint = <TSchema extends z.ZodType>(
  endpoint: EndpointDefinition,
  schema: TSchema,
  { params, query, body }: EndpointRequest = {},
) => {
  const client = endpoint.access === "public" ? publicHttp : http;

  return client(endpoint.method, buildPath(endpoint.path, params), {
    query,
    body,
    schema,
  });
};

export function callEndpoint<TEndpoint extends EndpointDefinition>(
  endpoint: TEndpoint,
  ...args: EndpointArgsTuple<TEndpoint>
): Promise<EndpointResponse<TEndpoint>>;
export function callEndpoint(
  endpoint: EndpointDefinition,
  args?: EndpointRequest,
) {
  return requestEndpoint(
    endpoint,
    endpoint.response ?? emptyResponseSchema,
    args,
  );
}

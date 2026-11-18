import type {
  EndpointAccess,
  EndpointDefinition,
  User,
} from "@pulse/contracts";
import { HttpHandler, type HttpResponseInit } from "msw";
import { z } from "zod";
import { apiPath } from "./api-path";
import {
  type AuthedArgs,
  type RequestArgs,
  type Resolver,
  authenticated,
  guarded,
  handle,
} from "./handler";
import { parseBody, parseQuery } from "./request";
import { json } from "./responses";

type Parsed<TEndpoint, TKey extends "body" | "query"> = TEndpoint extends {
  [Key in TKey]: infer TSchema extends z.ZodType;
}
  ? z.output<TSchema>
  : undefined;

type Responder<TEndpoint> = TEndpoint extends {
  response: infer TSchema extends z.ZodType;
}
  ? (data: z.input<TSchema>, init?: HttpResponseInit) => Response
  : never;

type Caller<TEndpoint> = TEndpoint extends { access: "public" }
  ? RequestArgs
  : AuthedArgs;

type RouteArgs<TEndpoint> = Caller<TEndpoint> & {
  body: Parsed<TEndpoint, "body">;
  query: Parsed<TEndpoint, "query">;
  respond: Responder<TEndpoint>;
};

type CallerArgs = RequestArgs & { user?: User };

type UntypedRouteArgs = CallerArgs & {
  body: unknown;
  query: unknown;
  respond: (data: unknown, init?: HttpResponseInit) => Response;
};

const withAccess = (access: EndpointAccess, resolver: Resolver<CallerArgs>) => {
  if (access === "public") {
    return handle(resolver);
  }

  return access === "authenticated"
    ? authenticated(resolver)
    : guarded(access, resolver);
};

export function route<TEndpoint extends EndpointDefinition>(
  endpoint: TEndpoint,
  resolver: Resolver<RouteArgs<TEndpoint>>,
): HttpHandler;

export function route(
  {
    method,
    path,
    access,
    body,
    query,
    response = z.never(),
  }: EndpointDefinition,
  resolver: Resolver<UntypedRouteArgs>,
) {
  return new HttpHandler(
    method,
    apiPath(path),
    withAccess(access, async (args) =>
      resolver({
        ...args,
        body: body && (await parseBody(args.request, body)),
        query: query && parseQuery(args.request, query),
        respond: (data, init) => json(response, data, init),
      }),
    ),
  );
}

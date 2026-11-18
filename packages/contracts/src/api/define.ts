import type { z } from "zod";
import type { Permission } from "../rbac/index.ts";

export type ApiMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type EndpointAccess = "public" | "authenticated" | Permission;

export type EndpointDefinition = {
  method: ApiMethod;
  path: string;
  access: EndpointAccess;
  body?: z.ZodType;
  query?: z.ZodType;
  response?: z.ZodType;
};

export const defineEndpoint = <const TEndpoint extends EndpointDefinition>(
  endpoint: TEndpoint,
) => endpoint;

export type ResourceDefinition = {
  path: string;
  permissions: { read: Permission; write: Permission };
  item: z.ZodType;
  listQuery: z.ZodType;
  create?: z.ZodType;
  update?: z.ZodType;
};

export const defineResource = <const TResource extends ResourceDefinition>(
  resource: TResource,
) => resource;

export const itemPath = (resource: Pick<ResourceDefinition, "path">) =>
  `${resource.path}/:id`;

export const buildPath = (path: string, params: Record<string, string> = {}) =>
  path.replace(/:(\w+)/g, (_match, key: string) =>
    encodeURIComponent(params[key] ?? ""),
  );

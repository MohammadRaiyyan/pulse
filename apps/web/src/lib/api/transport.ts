import { type ApiMethod, apiErrorResponseSchema } from "@pulse/contracts";
import type { z } from "zod";
import { env } from "@/config/env";
import { getAccessToken } from "./access-token";
import { ApiError } from "./api-error";
import { toSearchParams } from "./search-params";

export type RequestOptions<TSchema extends z.ZodType> = {
  schema: TSchema;
  query?: object;
  body?: unknown;
};

const NO_CONTENT_STATUS = 204;

const buildUrl = (path: string, query?: object) => {
  const searchParams = toSearchParams(query);
  const queryString = searchParams.size > 0 ? `?${searchParams}` : "";

  return `${env.apiUrl}${path}${queryString}`;
};

const buildHeaders = (hasBody: boolean, accept: string) => {
  const headers = new Headers({ Accept: accept });
  const accessToken = getAccessToken();

  if (hasBody) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  return headers;
};

const send = async (
  method: ApiMethod,
  path: string,
  { query, body }: Omit<RequestOptions<z.ZodType>, "schema">,
  accept = "application/json",
) => {
  const hasBody = body !== undefined;

  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers: buildHeaders(hasBody, accept),
      body: hasBody ? JSON.stringify(body) : undefined,
      credentials: "include",
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Unable to reach the server. Check your connection.",
    });
  }
};

const readBody = async (response: Response): Promise<unknown> => {
  if (response.status === NO_CONTENT_STATUS) {
    return undefined;
  }

  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const parseRetryAfter = (response: Response) => {
  const seconds = Number(response.headers.get("Retry-After"));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

const toApiError = async (response: Response) => {
  const parsed = apiErrorResponseSchema.safeParse(await readBody(response));

  if (!parsed.success) {
    return new ApiError({
      status: response.status,
      code: "INTERNAL_ERROR",
      message: response.statusText || "Request failed",
    });
  }

  return new ApiError({
    status: response.status,
    ...parsed.data.error,
    retryAfterSeconds: parseRetryAfter(response),
  });
};

const parseResponse = async <TSchema extends z.ZodType>(
  response: Response,
  schema: TSchema,
): Promise<z.output<TSchema>> => {
  const parsed = schema.safeParse(await readBody(response));

  if (!parsed.success) {
    throw new ApiError({
      status: response.status,
      code: "INVALID_RESPONSE",
      message: "The server returned an unexpected response.",
    });
  }

  return parsed.data;
};

export const executeRequest = async <TSchema extends z.ZodType>(
  method: ApiMethod,
  path: string,
  { schema, ...options }: RequestOptions<TSchema>,
  onUnauthorized?: () => Promise<boolean>,
): Promise<z.output<TSchema>> => {
  let response = await send(method, path, options);

  if (response.status === 401 && onUnauthorized && (await onUnauthorized())) {
    response = await send(method, path, options);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return parseResponse(response, schema);
};

export type DownloadedFile = {
  blob: Blob;
  filename: string | null;
};

const FILENAME_PATTERN = /filename="?([^";]+)"?/;

const readFilename = (response: Response) =>
  response.headers.get("Content-Disposition")?.match(FILENAME_PATTERN)?.[1] ??
  null;

export const executeDownload = async (
  path: string,
  query: object | undefined,
  accept: string,
  onUnauthorized?: () => Promise<boolean>,
): Promise<DownloadedFile> => {
  let response = await send("GET", path, { query }, accept);

  if (response.status === 401 && onUnauthorized && (await onUnauthorized())) {
    response = await send("GET", path, { query }, accept);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  return { blob: await response.blob(), filename: readFilename(response) };
};

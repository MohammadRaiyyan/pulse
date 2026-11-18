import type {
  ApiErrorCode,
  ApiErrorResponse,
  FieldErrors,
} from "@pulse/contracts";
import { HttpResponse, type HttpResponseInit } from "msw";
import { z } from "zod";

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

type ErrorResponseOptions = {
  fieldErrors?: FieldErrors;
  headers?: HeadersInit;
};

export const errorResponse = (
  code: ApiErrorCode,
  message: string,
  { fieldErrors, headers }: ErrorResponseOptions = {},
) =>
  HttpResponse.json<ApiErrorResponse>(
    { error: { code, message, fieldErrors } },
    { status: statusByCode[code], headers },
  );

export const notFound = (label: string) =>
  errorResponse("NOT_FOUND", `${label} not found`);

export const noContent = (headers?: HeadersInit) =>
  new HttpResponse(null, { status: 204, headers });

export const json = <TSchema extends z.ZodType>(
  schema: TSchema,
  data: z.input<TSchema>,
  init?: HttpResponseInit,
) => HttpResponse.json(z.json().parse(schema.parse(data)), init);

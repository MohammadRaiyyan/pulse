import type { PathParams } from "msw";
import { z } from "zod";
import { errorResponse } from "./responses";

const toFieldErrors = (error: z.ZodError) =>
  Object.fromEntries(
    Object.entries(z.flattenError(error).fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );

const validationError = (message: string) => (error: z.ZodError) =>
  errorResponse("VALIDATION_ERROR", message, {
    fieldErrors: toFieldErrors(error),
  });

const parseOrThrow = <TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
  toError: (error: z.ZodError) => Response,
): z.output<TSchema> => {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw toError(parsed.error);
  }

  return parsed.data;
};

export const parseBody = async <TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
) =>
  parseOrThrow(
    schema,
    await request.json().catch(() => undefined),
    validationError("Some fields are invalid"),
  );

export const parseQuery = <TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
) =>
  parseOrThrow(
    schema,
    Object.fromEntries(new URL(request.url).searchParams),
    validationError("Invalid query parameters"),
  );

export const getParam = (params: PathParams, name: string) => {
  const value = params[name];

  return typeof value === "string" ? value : "";
};

export const parseParam = <TSchema extends z.ZodType>(
  params: PathParams,
  name: string,
  schema: TSchema,
) =>
  parseOrThrow(schema, getParam(params, name), () =>
    errorResponse("NOT_FOUND", `Unknown ${name}`),
  );

import { idSchema } from "@pulse/contracts";
import { z } from "zod";
import { AppError, notFound } from "./errors.ts";

const toFieldErrors = (error: z.ZodError) => {
  const fieldErrors: Record<string, string[]> = {};

  for (const [field, messages] of Object.entries(
    z.flattenError(error).fieldErrors,
  )) {
    if (Array.isArray(messages)) {
      fieldErrors[field] = messages;
    }
  }

  return fieldErrors;
};

export const validate = <TSchema extends z.ZodType>(
  schema: TSchema,
  data: unknown,
  message = "Some fields are invalid",
): z.output<TSchema> => {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", message, {
      fieldErrors: toFieldErrors(result.error),
    });
  }

  return result.data;
};

export const validateQuery = <TSchema extends z.ZodType>(
  schema: TSchema,
  query: unknown,
) => validate(schema, query, "Invalid query parameters");

export const validateId = (id: unknown, label: string) => {
  const result = idSchema.safeParse(id);

  if (!result.success) {
    throw notFound(label);
  }

  return result.data;
};

export const validateParam = <TSchema extends z.ZodType>(
  schema: TSchema,
  value: unknown,
  name: string,
): z.output<TSchema> => {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError("NOT_FOUND", `Unknown ${name}`);
  }

  return result.data;
};

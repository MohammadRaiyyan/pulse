import type { ErrorRequestHandler, RequestHandler } from "express";
import { isProduction } from "../config/env.ts";
import { toDatabaseAppError } from "../lib/database-errors.ts";
import { AppError } from "../lib/errors.ts";
import { logger } from "../lib/logger.ts";

const hasType = (error: unknown, type: string) =>
  typeof error === "object" &&
  error !== null &&
  "type" in error &&
  error.type === type;

const toAppError = (error: unknown) => {
  if (error instanceof AppError) {
    return error;
  }

  if (hasType(error, "entity.parse.failed")) {
    return new AppError("VALIDATION_ERROR", "Request body is not valid JSON");
  }

  if (hasType(error, "entity.too.large")) {
    return new AppError("VALIDATION_ERROR", "Request body is too large");
  }

  const databaseError = toDatabaseAppError(error);

  if (databaseError) {
    return databaseError;
  }

  logger.error({ err: error }, "Unhandled error");

  return new AppError(
    "INTERNAL_ERROR",
    isProduction ? "Something went wrong" : String(error),
  );
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const appError = toAppError(error);

  if (appError.retryAfterSeconds) {
    res.setHeader("Retry-After", String(appError.retryAfterSeconds));
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      fieldErrors: appError.fieldErrors,
    },
  });
};

export const notFoundHandler: RequestHandler = () => {
  throw new AppError("NOT_FOUND", "Route not found");
};

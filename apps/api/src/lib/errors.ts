import type { ApiErrorCode, FieldErrors } from "@pulse/contracts";

const statusByCode: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

type AppErrorOptions = {
  fieldErrors?: FieldErrors;
  retryAfterSeconds?: number;
};

export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fieldErrors: FieldErrors | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = statusByCode[code];
    this.fieldErrors = options.fieldErrors;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export const notFound = (label: string) =>
  new AppError("NOT_FOUND", `${label} not found`);

export const forbidden = (message: string) =>
  new AppError("FORBIDDEN", message);

export const conflict = (message: string, fieldErrors?: FieldErrors) =>
  new AppError("CONFLICT", message, { fieldErrors });

export const unauthorized = (message: string) =>
  new AppError("UNAUTHORIZED", message);

export const badRequest = (message: string, fieldErrors?: FieldErrors) =>
  new AppError("VALIDATION_ERROR", message, { fieldErrors });

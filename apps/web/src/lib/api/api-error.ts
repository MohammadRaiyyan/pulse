import type { ApiErrorCode, FieldErrors } from "@pulse/contracts";

export type ClientErrorCode =
  ApiErrorCode | "NETWORK_ERROR" | "INVALID_RESPONSE";

type ApiErrorOptions = {
  status: number;
  code: ClientErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
  retryAfterSeconds?: number | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly fieldErrors: FieldErrors;
  readonly retryAfterSeconds: number | null;

  constructor({
    status,
    code,
    message,
    fieldErrors = {},
    retryAfterSeconds = null,
  }: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;

export const hasErrorCode = (
  error: unknown,
  code: ClientErrorCode,
): error is ApiError => isApiError(error) && error.code === code;

const FALLBACK_ERROR_MESSAGE = "Something went wrong. Please try again.";

export const getErrorMessage = (error: unknown) => {
  if (hasErrorCode(error, "RATE_LIMITED") && error.retryAfterSeconds) {
    return `${error.message} Try again in ${error.retryAfterSeconds}s.`;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return FALLBACK_ERROR_MESSAGE;
};

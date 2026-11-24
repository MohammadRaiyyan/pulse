const hasMessage = (error: unknown): error is { message: string } =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string";

export const toErrorMessage = (error: unknown) => {
  if (typeof error === "string") {
    return { message: error };
  }

  return hasMessage(error) ? { message: error.message } : undefined;
};

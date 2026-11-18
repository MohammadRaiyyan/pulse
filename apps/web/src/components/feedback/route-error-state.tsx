import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { ErrorState } from "./error-state";

export const RouteErrorState = ({ error, reset }: ErrorComponentProps) => {
  const router = useRouter();
  const queryErrorBoundary = useQueryErrorResetBoundary();

  const retry = async () => {
    queryErrorBoundary.reset();
    reset();
    await router.invalidate();
  };

  return <ErrorState error={error} onRetry={retry} />;
};

import {
  type Mutation,
  MutationCache,
  QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage, isApiError } from "@/lib/api/api-error";

const MAX_QUERY_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([0, 502, 503, 504]);

const shouldRetry = (failureCount: number, error: unknown) =>
  failureCount < MAX_QUERY_RETRIES &&
  isApiError(error) &&
  RETRYABLE_STATUSES.has(error.status);

const notifyMutationError = (
  error: unknown,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown>,
) => {
  if (mutation.meta?.errorDisplay !== "inline") {
    toast.error(getErrorMessage(error));
  }
};

export const createQueryClient = () => {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetry,
      },
      mutations: {
        retry: false,
      },
    },
    mutationCache: new MutationCache({
      onError: notifyMutationError,
      onSuccess: () =>
        queryClient.invalidateQueries({
          predicate: (query) => query.meta?.refreshOnMutation === true,
        }),
    }),
  });

  return queryClient;
};

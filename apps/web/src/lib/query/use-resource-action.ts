import {
  type MutationMeta,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { patchCachedItem, restoreSnapshot } from "./optimistic";
import type { AnyResource } from "./resource";

type Identifiable = { id: string };

type ResourceActionOptions<TItem, TVariables, TResult> = {
  action: (variables: TVariables) => Promise<TResult>;
  patch?: (item: TItem, variables: TVariables) => TItem;
  successMessage: string | ((result: TResult) => string);
  meta?: MutationMeta;
};

export const useResourceAction = <
  TItem extends Identifiable,
  TVariables extends Identifiable,
  TResult,
>(
  resource: AnyResource<TItem>,
  {
    action,
    patch,
    successMessage,
    meta,
  }: ResourceActionOptions<TItem, TVariables, TResult>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: action,
    onMutate: (variables) =>
      patch
        ? patchCachedItem<TItem>(
            queryClient,
            resource.keys,
            variables.id,
            (item) => patch(item, variables),
          )
        : undefined,
    onError: (_error, _variables, snapshot) =>
      restoreSnapshot(queryClient, snapshot),
    onSuccess: (result) => {
      toast.success(
        typeof successMessage === "string"
          ? successMessage
          : successMessage(result),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: resource.keys.all }),
    meta,
  });
};

import {
  type MutationMeta,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { AnyResource } from "./resource";
import { useResourceAction } from "./use-resource-action";

type Identifiable = { id: string };

type ResourceMutationOptions<TItem> = {
  successMessage?: (item: TItem) => string;
  meta?: MutationMeta;
};

export const useCreateResource = <TItem, TCreate>(
  resource: AnyResource<TItem, TCreate>,
  {
    successMessage = () => `${resource.label} created`,
    meta,
  }: ResourceMutationOptions<TItem> = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TCreate) => resource.api.create(input),
    onSuccess: async (item) => {
      toast.success(successMessage(item));
      await queryClient.invalidateQueries({ queryKey: resource.keys.all });
    },
    meta,
  });
};

type UpdateOptions<TItem> = ResourceMutationOptions<TItem> & {
  optimistic?: boolean;
};

type UpdateVariables<TUpdate> = {
  id: string;
  input: TUpdate;
};

const mergeInput = <TItem extends object>(
  item: TItem,
  input: Partial<TItem>,
): TItem => ({ ...item, ...input });

export const useUpdateResource = <
  TItem extends Identifiable,
  TUpdate extends Partial<TItem>,
>(
  resource: AnyResource<TItem, never, TUpdate>,
  {
    successMessage = () => `${resource.label} updated`,
    optimistic = false,
    meta,
  }: UpdateOptions<TItem> = {},
) =>
  useResourceAction(resource, {
    action: ({ id, input }: UpdateVariables<TUpdate>) =>
      resource.api.update(id, input),
    patch: optimistic
      ? (item, { input }) => mergeInput(item, input)
      : undefined,
    successMessage,
    meta,
  });

export const useDeleteResource = (
  resource: AnyResource,
  {
    successMessage = `${resource.label} deleted`,
  }: { successMessage?: string } = {},
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => resource.api.remove(id),
    onSuccess: async (_, id) => {
      toast.success(successMessage);
      queryClient.removeQueries({ queryKey: resource.keys.detail(id) });
      await queryClient.invalidateQueries({ queryKey: resource.keys.lists() });
    },
  });
};

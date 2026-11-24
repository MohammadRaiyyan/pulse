import type { TransferOwnershipInput } from "@pulse/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSessionActions } from "@/features/auth/hooks/use-session-actions";
import { inlineErrors } from "@/lib/query/meta";
import { memberApi, memberResource } from "../api/member-resource";

type TransferOwnershipVariables = {
  id: string;
  input: TransferOwnershipInput;
};

export const useTransferOwnership = () => {
  const queryClient = useQueryClient();
  const session = useSessionActions();

  return useMutation({
    mutationFn: ({ id, input }: TransferOwnershipVariables) =>
      memberApi.transferOwnership(id, input),
    onSuccess: async ({ previousOwner, newOwner }) => {
      toast.success(`${newOwner.name} is now the owner`);
      await session.start(previousOwner);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: memberResource.keys.all }),
    meta: inlineErrors,
  });
};

import {
  type UpdateStatusPageSettingsInput,
  endpoints,
} from "@pulse/contracts";
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { inlineErrors } from "@/lib/query/meta";
import { createQueryKeys } from "@/lib/query/query-keys";

export const PUBLIC_STATUS_REFRESH_MS = 60_000;

const statusPageKeys = createQueryKeys("status-page");

export const statusPageSettingsQuery = queryOptions({
  queryKey: statusPageKeys.detail("settings"),
  queryFn: () => callEndpoint(endpoints.getStatusPageSettings),
});

export const publicStatusQuery = queryOptions({
  queryKey: statusPageKeys.detail("public"),
  queryFn: () => callEndpoint(endpoints.getPublicStatus),
  refetchInterval: PUBLIC_STATUS_REFRESH_MS,
  staleTime: 0,
});

export const useUpdateStatusPageSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateStatusPageSettingsInput) =>
      callEndpoint(endpoints.updateStatusPageSettings, { body: input }),
    onSuccess: async (settings) => {
      queryClient.setQueryData(statusPageSettingsQuery.queryKey, settings);
      toast.success("Status page settings saved");
      await queryClient.invalidateQueries({
        queryKey: publicStatusQuery.queryKey,
      });
    },
    meta: inlineErrors,
  });
};

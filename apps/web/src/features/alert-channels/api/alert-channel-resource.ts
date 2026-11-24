import { MAX_PAGE_SIZE, endpoints, resources } from "@pulse/contracts";
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { createResource } from "@/lib/query/resource";

export const alertChannelResource = createResource(
  resources.alertChannels,
  "Alert channel",
);

export const alertChannelOptionsQuery = queryOptions({
  ...alertChannelResource.queries.list({ page: 1, pageSize: MAX_PAGE_SIZE }),
  select: (page) =>
    page.items.map((channel) => ({ value: channel.id, label: channel.name })),
});

export const signingSecretQuery = (id: string) =>
  queryOptions({
    queryKey: [...alertChannelResource.keys.all, "signing-secret", id],
    queryFn: () =>
      callEndpoint(endpoints.getAlertChannelSigningSecret, { params: { id } }),
    staleTime: Infinity,
  });

export const useTestAlertChannel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) =>
      callEndpoint(endpoints.testAlertChannel, { params: { id } }),
    onSuccess: (delivery, { name }) => {
      if (delivery.status === "success") {
        toast.success(`Test alert delivered to ${name}`);
        return;
      }

      toast.error(`Test alert to ${name} failed`, {
        description: delivery.lastError ?? undefined,
      });
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: alertChannelResource.keys.lists(),
      }),
  });
};

export const useRotateSigningSecret = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      callEndpoint(endpoints.rotateAlertChannelSigningSecret, {
        params: { id },
      }),
    onSuccess: (secret, { id }) => {
      queryClient.setQueryData(signingSecretQuery(id).queryKey, secret);
      toast.success("Signing secret rotated");
    },
  });
};

import {
  type AlertChannel,
  MAX_PAGE_SIZE,
  type UpdateAlertChannelInput,
  endpoints,
  resources,
} from "@pulse/contracts";
import type { MutationMeta } from "@tanstack/react-query";
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { createResource } from "@/lib/query/resource";
import { useResourceAction } from "@/lib/query/use-resource-action";
import { channelTypeMeta } from "../alert-channel-meta";

export const alertChannelResource = createResource(
  resources.alertChannels,
  "Integration",
);

export const alertChannelOptionsQuery = queryOptions({
  ...alertChannelResource.queries.list({ page: 1, pageSize: MAX_PAGE_SIZE }),
  select: (page) =>
    page.items.map((channel) => ({
      value: channel.id,
      label: channel.name,
      icon: channelTypeMeta[channel.destination.type].icon,
    })),
});

export const alertChannelCountsQuery = queryOptions({
  queryKey: [...alertChannelResource.keys.all, "counts"],
  queryFn: () => callEndpoint(endpoints.countAlertChannelsByType),
  select: (counts) =>
    new Map(counts.map(({ type, count }) => [type, count] as const)),
});

type UpdateAlertChannelVariables = {
  id: string;
  input: UpdateAlertChannelInput;
};

type UpdateAlertChannelOptions = {
  optimistic?: boolean;
  successMessage?: (channel: AlertChannel) => string;
  meta?: MutationMeta;
};

const applyToggles = (
  channel: AlertChannel,
  { input }: UpdateAlertChannelVariables,
): AlertChannel => ({
  ...channel,
  name: input.name ?? channel.name,
  isEnabled: input.isEnabled ?? channel.isEnabled,
});

export const useUpdateAlertChannel = ({
  optimistic = false,
  successMessage = () => "Integration updated",
  meta,
}: UpdateAlertChannelOptions = {}) =>
  useResourceAction(alertChannelResource, {
    action: ({ id, input }: UpdateAlertChannelVariables) =>
      alertChannelResource.api.update(id, input),
    patch: optimistic ? applyToggles : undefined,
    successMessage,
    meta,
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

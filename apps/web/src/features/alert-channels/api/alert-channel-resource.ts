import { MAX_PAGE_SIZE, endpoints, resources } from "@pulse/contracts";
import { queryOptions } from "@tanstack/react-query";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { createResource } from "@/lib/query/resource";
import { useResourceAction } from "@/lib/query/use-resource-action";

export const alertChannelResource = createResource(
  resources.alertChannels,
  "Alert channel",
);

export const alertChannelOptionsQuery = queryOptions({
  ...alertChannelResource.queries.list({ page: 1, pageSize: MAX_PAGE_SIZE }),
  select: (page) =>
    page.items.map((channel) => ({ value: channel.id, label: channel.name })),
});

export const useTestAlertChannel = () =>
  useResourceAction(alertChannelResource, {
    action: ({ id }: { id: string }) =>
      callEndpoint(endpoints.testAlertChannel, { params: { id } }),
    successMessage: "Test alert sent",
  });

import { MAX_PAGE_SIZE, endpoints, resources } from "@pulse/contracts";
import { queryOptions } from "@tanstack/react-query";
import { monitorResource } from "@/features/monitors/api/monitor-resource";
import { webhookResource } from "@/features/webhooks/api/webhook-resource";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { createResource } from "@/lib/query/resource";

export const serviceResource = createResource(resources.services, "Service");

const allItems = { page: 1, pageSize: MAX_PAGE_SIZE };

const toOptions = (page: { items: { id: string; name: string }[] }) =>
  page.items.map((item) => ({ value: item.id, label: item.name }));

export const serviceOptionsQuery = queryOptions({
  ...serviceResource.queries.list(allItems),
  select: toOptions,
});

export const monitorOptionsQuery = queryOptions({
  ...monitorResource.queries.list(allItems),
  select: toOptions,
});

export const webhookOptionsQuery = queryOptions({
  ...webhookResource.queries.list(allItems),
  select: toOptions,
});

export const serviceOverviewQuery = (id: string) =>
  queryOptions({
    queryKey: [...serviceResource.keys.detail(id), "overview"],
    queryFn: () => callEndpoint(endpoints.getServiceOverview, { params: { id } }),
  });

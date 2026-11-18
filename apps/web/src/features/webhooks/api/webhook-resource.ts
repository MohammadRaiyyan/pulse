import { endpoints, resources } from "@pulse/contracts";
import { createResource } from "@/lib/query/resource";
import { createSubListQuery } from "@/lib/query/sub-list-query";
import { WEBHOOK_EVENTS_PAGE_SIZE } from "../webhook-constants";

export const webhookResource = createResource(
  resources.webhooks,
  "Webhook endpoint",
);

const webhookEventsQuery = createSubListQuery(
  webhookResource.keys,
  endpoints.listWebhookEvents,
  "events",
);

export const webhookEventHistoryQuery = (id: string, page: number) =>
  webhookEventsQuery(id, { page, pageSize: WEBHOOK_EVENTS_PAGE_SIZE });

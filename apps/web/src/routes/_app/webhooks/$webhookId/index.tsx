import { pageQuerySchema } from "@pulse/contracts";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PagedQueryView } from "@/components/data/paged-query-view";
import { guard } from "@/features/auth/guards";
import {
  webhookEventHistoryQuery,
  webhookResource,
} from "@/features/webhooks/api/webhook-resource";
import { WebhookActions } from "@/features/webhooks/components/webhook-actions";
import { WebhookDetailLayout } from "@/features/webhooks/components/webhook-detail-layout";
import { WebhookDetailSkeleton } from "@/features/webhooks/components/webhook-detail-skeleton";
import { WebhookDetails } from "@/features/webhooks/components/webhook-details";
import {
  WebhookEventsTable,
  WebhookEventsTableSkeleton,
} from "@/features/webhooks/components/webhook-events-table";
import { WebhookStatusBadge } from "@/features/webhooks/components/webhook-status-badge";
import { WEBHOOK_EVENTS_PAGE_SIZE } from "@/features/webhooks/webhook-constants";

const WebhookDetailPage = () => {
  const { webhookId } = Route.useParams();
  const { page } = Route.useSearch();
  const { data: webhook } = useSuspenseQuery(
    webhookResource.queries.detail(webhookId),
  );

  return (
    <WebhookDetailLayout
      title={webhook.name}
      badge={<WebhookStatusBadge value={webhook.status} />}
      actions={<WebhookActions webhook={webhook} />}
      details={<WebhookDetails webhook={webhook} />}
      events={
        <PagedQueryView
          params={page}
          query={(nextPage) => webhookEventHistoryQuery(webhookId, nextPage)}
          fallback={
            <WebhookEventsTableSkeleton rows={WEBHOOK_EVENTS_PAGE_SIZE} />
          }
        >
          {(events) => <WebhookEventsTable events={events} />}
        </PagedQueryView>
      }
    />
  );
};

export const Route = createFileRoute("/_app/webhooks/$webhookId/")({
  validateSearch: pageQuerySchema,
  beforeLoad: guard("webhook:read"),
  loaderDeps: ({ search }) => search,
  loader: ({
    context: { queryClient },
    params: { webhookId },
    deps: { page },
  }) => {
    void queryClient.prefetchQuery(webhookEventHistoryQuery(webhookId, page));

    return queryClient.ensureQueryData(
      webhookResource.queries.detail(webhookId),
    );
  },
  pendingComponent: WebhookDetailSkeleton,
  component: WebhookDetailPage,
});

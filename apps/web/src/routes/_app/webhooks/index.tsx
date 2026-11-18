import { paginationQuerySchema } from "@pulse/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { PagedQueryView } from "@/components/data/paged-query-view";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { webhookResource } from "@/features/webhooks/api/webhook-resource";
import { NewWebhookButton } from "@/features/webhooks/components/new-webhook-button";
import {
  WebhooksTable,
  WebhooksTableSkeleton,
} from "@/features/webhooks/components/webhooks-table";

const WebhooksPage = () => {
  const search = Route.useSearch();

  return (
    <Page title="Webhooks" actions={<NewWebhookButton />}>
      <ContentSection
        title="Endpoints"
        description="Capture incoming webhooks and alert when they go quiet."
      >
        <PagedQueryView
          fallback={<WebhooksTableSkeleton />}
          params={search}
          query={webhookResource.queries.list}
        >
          {(webhooks) => <WebhooksTable webhooks={webhooks} />}
        </PagedQueryView>
      </ContentSection>
    </Page>
  );
};

export const Route = createFileRoute("/_app/webhooks/")({
  validateSearch: paginationQuerySchema,
  beforeLoad: guard("webhook:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(webhookResource.queries.list(deps));
  },
  component: WebhooksPage,
});

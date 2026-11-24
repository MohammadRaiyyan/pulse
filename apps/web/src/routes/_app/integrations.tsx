import { paginationQuerySchema } from "@pulse/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { PagedQueryView } from "@/components/data/paged-query-view";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import {
  alertChannelCountsQuery,
  alertChannelResource,
} from "@/features/alert-channels/api/alert-channel-resource";
import {
  AlertChannelsTable,
  AlertChannelsTableSkeleton,
} from "@/features/alert-channels/components/alert-channels-table";
import { IntegrationCatalog } from "@/features/alert-channels/components/integration-catalog";
import { guard } from "@/features/auth/guards";

const IntegrationsPage = () => {
  const search = Route.useSearch();

  return (
    <Page title="Integrations">
      <ContentSection
        title="Providers"
        description="Connect the tools your team uses to hear about incidents."
      >
        <IntegrationCatalog />
      </ContentSection>
      <ContentSection
        title="Connected"
        description="Where notifications go when something breaks, and how the last delivery went."
      >
        <PagedQueryView
          fallback={<AlertChannelsTableSkeleton />}
          params={search}
          query={alertChannelResource.queries.list}
        >
          {(channels) => <AlertChannelsTable channels={channels} />}
        </PagedQueryView>
      </ContentSection>
    </Page>
  );
};

export const Route = createFileRoute("/_app/integrations")({
  validateSearch: paginationQuerySchema,
  beforeLoad: guard("alert-channel:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(alertChannelCountsQuery);
    void context.queryClient.prefetchQuery(
      alertChannelResource.queries.list(deps),
    );
  },
  component: IntegrationsPage,
});

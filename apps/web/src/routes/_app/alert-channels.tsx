import { paginationQuerySchema } from "@pulse/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { PagedQueryView } from "@/components/data/paged-query-view";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { alertChannelResource } from "@/features/alert-channels/api/alert-channel-resource";
import {
  AlertChannelsTable,
  AlertChannelsTableSkeleton,
} from "@/features/alert-channels/components/alert-channels-table";
import { NewAlertChannelButton } from "@/features/alert-channels/components/new-alert-channel-button";
import { guard } from "@/features/auth/guards";

const AlertChannelsPage = () => {
  const search = Route.useSearch();

  return (
    <Page title="Alert channels" actions={<NewAlertChannelButton />}>
      <ContentSection
        title="Channels"
        description="Where notifications go when something breaks."
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

export const Route = createFileRoute("/_app/alert-channels")({
  validateSearch: paginationQuerySchema,
  beforeLoad: guard("alert-channel:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(
      alertChannelResource.queries.list(deps),
    );
  },
  component: AlertChannelsPage,
});

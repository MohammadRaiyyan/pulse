import { monitorListQuerySchema } from "@pulse/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { PagedQueryView } from "@/components/data/paged-query-view";
import {
  ContentSection,
  SectionActions,
} from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { monitorResource } from "@/features/monitors/api/monitor-resource";
import { MonitorFilters } from "@/features/monitors/components/monitor-filters";
import {
  MonitorsTable,
  MonitorsTableSkeleton,
} from "@/features/monitors/components/monitors-table";
import { NewMonitorButton } from "@/features/monitors/components/new-monitor-button";
import { useFilterNavigate } from "@/lib/router/use-filter-navigate";

const MonitorsPage = () => {
  const search = Route.useSearch();
  const filter = useFilterNavigate();

  return (
    <Page title="Monitors" actions={<NewMonitorButton />}>
      <ContentSection
        title="All monitors"
        description="Scheduled HTTP checks for your APIs and services."
      >
        <SectionActions>
          <MonitorFilters
            status={search.status}
            search={search.search}
            onChange={filter}
          />
        </SectionActions>
        <PagedQueryView
          fallback={<MonitorsTableSkeleton />}
          params={search}
          query={monitorResource.queries.list}
        >
          {(monitors) => <MonitorsTable monitors={monitors} />}
        </PagedQueryView>
      </ContentSection>
    </Page>
  );
};

export const Route = createFileRoute("/_app/monitors/")({
  validateSearch: monitorListQuerySchema,
  beforeLoad: guard("monitor:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(monitorResource.queries.list(deps));
  },
  component: MonitorsPage,
});

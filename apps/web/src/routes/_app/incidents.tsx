import { incidentListQuerySchema } from "@pulse/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { FilterTabs } from "@/components/data/filter-tabs";
import { PagedQueryView } from "@/components/data/paged-query-view";
import {
  ContentSection,
  SectionActions,
} from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { incidentResource } from "@/features/incidents/api/incident-resource";
import {
  IncidentsTable,
  IncidentsTableSkeleton,
} from "@/features/incidents/components/incidents-table";
import { incidentStatusOptions } from "@/features/incidents/incident-meta";
import { useFilterNavigate } from "@/lib/router/use-filter-navigate";

const IncidentsPage = () => {
  const search = Route.useSearch();
  const filter = useFilterNavigate();

  return (
    <Page title="Incidents">
      <ContentSection
        title="Incident log"
        description="Outages and silent webhooks detected by Pulse."
      >
        <SectionActions>
          <FilterTabs
            label="Status"
            value={search.status}
            options={incidentStatusOptions}
            onChange={(status) => filter({ status })}
          />
        </SectionActions>
        <PagedQueryView
          fallback={<IncidentsTableSkeleton />}
          params={search}
          query={incidentResource.queries.list}
        >
          {(incidents) => <IncidentsTable incidents={incidents} />}
        </PagedQueryView>
      </ContentSection>
    </Page>
  );
};

export const Route = createFileRoute("/_app/incidents")({
  validateSearch: incidentListQuerySchema,
  beforeLoad: guard("incident:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(incidentResource.queries.list(deps));
  },
  component: IncidentsPage,
});

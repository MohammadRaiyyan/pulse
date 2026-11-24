import { paginationQuerySchema } from "@pulse/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { PagedQueryView } from "@/components/data/paged-query-view";
import {
  ContentSection,
  SectionActions,
} from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { incidentResource } from "@/features/incidents/api/incident-resource";
import { IncidentViewTabs } from "@/features/incidents/components/incident-view-tabs";
import {
  IncidentsTable,
  IncidentsTableSkeleton,
} from "@/features/incidents/components/incidents-table";
import {
  DEFAULT_INCIDENT_VIEW,
  incidentViewSchema,
  toIncidentStatusFilter,
} from "@/features/incidents/incident-meta";
import { useFilterNavigate } from "@/lib/router/use-filter-navigate";

const incidentsSearchSchema = paginationQuerySchema.extend({
  status: incidentViewSchema.default(DEFAULT_INCIDENT_VIEW),
});

const IncidentsPage = () => {
  const { status, ...pagination } = Route.useSearch();
  const filter = useFilterNavigate();

  return (
    <Page title="Incidents">
      <ContentSection
        title="Incident log"
        description="Outages, slow responses and silent webhooks detected by Pulse."
      >
        <SectionActions>
          <IncidentViewTabs
            value={status}
            onChange={(nextStatus) => filter({ status: nextStatus })}
          />
        </SectionActions>
        <PagedQueryView
          fallback={<IncidentsTableSkeleton />}
          params={{ ...pagination, status: toIncidentStatusFilter(status) }}
          query={incidentResource.queries.list}
        >
          {(incidents) => <IncidentsTable incidents={incidents} view={status} />}
        </PagedQueryView>
      </ContentSection>
    </Page>
  );
};

export const Route = createFileRoute("/_app/incidents")({
  validateSearch: incidentsSearchSchema,
  beforeLoad: guard("incident:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps: { status, ...pagination } }) => {
    void context.queryClient.prefetchQuery(
      incidentResource.queries.list({
        ...pagination,
        status: toIncidentStatusFilter(status),
      }),
    );
  },
  component: IncidentsPage,
});

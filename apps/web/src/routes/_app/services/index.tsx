import { paginationQuerySchema } from "@pulse/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { PagedQueryView } from "@/components/data/paged-query-view";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { serviceResource } from "@/features/services/api/service-resource";
import { NewServiceButton } from "@/features/services/components/new-service-button";
import {
  ServicesTable,
  ServicesTableSkeleton,
} from "@/features/services/components/services-table";

const ServicesPage = () => {
  const search = Route.useSearch();

  return (
    <Page title="Services" actions={<NewServiceButton />}>
      <ContentSection
        title="All services"
        description="Monitors and webhooks grouped by what your users depend on."
      >
        <PagedQueryView
          fallback={<ServicesTableSkeleton />}
          params={search}
          query={serviceResource.queries.list}
        >
          {(services) => <ServicesTable services={services} />}
        </PagedQueryView>
      </ContentSection>
    </Page>
  );
};

export const Route = createFileRoute("/_app/services/")({
  validateSearch: paginationQuerySchema,
  beforeLoad: guard("monitor:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(serviceResource.queries.list(deps));
  },
  component: ServicesPage,
});

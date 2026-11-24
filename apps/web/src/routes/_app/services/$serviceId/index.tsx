import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { guard } from "@/features/auth/guards";
import { IncidentsTableSkeleton } from "@/features/incidents/components/incidents-table";
import {
  serviceOverviewQuery,
  serviceResource,
} from "@/features/services/api/service-resource";
import { ServiceActions } from "@/features/services/components/service-actions";
import { ServiceDetailLayout } from "@/features/services/components/service-detail-layout";
import {
  ServiceDetailSkeleton,
  UptimeBarsSkeleton,
} from "@/features/services/components/service-detail-skeleton";
import { ServiceDetails } from "@/features/services/components/service-details";
import { ServiceMembersTableSkeleton } from "@/features/services/components/service-members-table";
import {
  ServiceIncidents,
  ServiceMembers,
  ServiceUptime,
} from "@/features/services/components/service-overview";
import { ServiceStatusBadge } from "@/features/services/components/service-status-badge";

const ServiceDetailPage = () => {
  const { serviceId } = Route.useParams();
  const { data: service } = useSuspenseQuery(
    serviceResource.queries.detail(serviceId),
  );

  return (
    <ServiceDetailLayout
      title={service.name}
      badge={<ServiceStatusBadge value={service.status} />}
      actions={<ServiceActions service={service} />}
      details={<ServiceDetails service={service} />}
      uptime={
        <Suspense fallback={<UptimeBarsSkeleton />}>
          <ServiceUptime serviceId={serviceId} />
        </Suspense>
      }
      members={
        <Suspense fallback={<ServiceMembersTableSkeleton />}>
          <ServiceMembers serviceId={serviceId} />
        </Suspense>
      }
      incidents={
        <Suspense fallback={<IncidentsTableSkeleton rows={2} />}>
          <ServiceIncidents serviceId={serviceId} />
        </Suspense>
      }
    />
  );
};

export const Route = createFileRoute("/_app/services/$serviceId/")({
  beforeLoad: guard("monitor:read"),
  loader: ({ context: { queryClient }, params: { serviceId } }) => {
    void queryClient.prefetchQuery(serviceOverviewQuery(serviceId));

    return queryClient.ensureQueryData(
      serviceResource.queries.detail(serviceId),
    );
  },
  pendingComponent: ServiceDetailSkeleton,
  component: ServiceDetailPage,
});

import { Skeleton } from "@pulse/ui/components/skeleton";
import { ActionsSkeleton } from "@/components/skeleton/actions-skeleton";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { TitleSkeleton } from "@/components/skeleton/title-skeleton";
import { IncidentsTableSkeleton } from "@/features/incidents/components/incidents-table";
import { ServiceDetailLayout } from "./service-detail-layout";
import { ServiceDetailsSkeleton } from "./service-details";
import { ServiceMembersTableSkeleton } from "./service-members-table";

export const UptimeBarsSkeleton = () => (
  <div className="flex flex-col gap-2">
    <Skeleton className="h-8 w-full rounded-md" />
    <Skeleton className="h-4 w-full rounded-sm" />
  </div>
);

export const ServiceDetailSkeleton = () => (
  <ServiceDetailLayout
    title={<TitleSkeleton />}
    badge={<BadgeSkeleton />}
    actions={<ActionsSkeleton count={2} />}
    details={<ServiceDetailsSkeleton />}
    uptime={<UptimeBarsSkeleton />}
    members={<ServiceMembersTableSkeleton />}
    incidents={<IncidentsTableSkeleton rows={2} />}
  />
);

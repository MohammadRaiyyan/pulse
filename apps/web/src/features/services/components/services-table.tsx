import type { Service } from "@pulse/contracts";
import { LayersIcon } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { DataTableSkeleton } from "@/components/data/data-table-skeleton";
import { TableLink } from "@/components/data/table-link";
import { EmptyState } from "@/components/feedback/empty-state";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { formatCount } from "@/lib/format/number";
import { describeMembers } from "../service-members";
import { NewServiceButton } from "./new-service-button";
import { ServiceStatusBadge } from "./service-status-badge";
import { VisibilityBadge } from "./visibility-badge";

const columns: DataTableColumn<Service>[] = [
  {
    id: "name",
    header: "Service",
    skeleton: <TextSkeleton className="w-32" />,
    cell: (service) => (
      <TableLink to="/services/$serviceId" params={{ serviceId: service.id }}>
        {service.name}
      </TableLink>
    ),
  },
  {
    id: "status",
    header: "Status",
    skeleton: <BadgeSkeleton />,
    cell: (service) => <ServiceStatusBadge value={service.status} />,
  },
  {
    id: "members",
    header: "Members",
    skeleton: <TextSkeleton className="w-28" />,
    className: "text-muted-foreground",
    cell: describeMembers,
  },
  {
    id: "incidents",
    header: "Active incidents",
    cell: (service) => formatCount(service.activeIncidentCount),
  },
  {
    id: "visibility",
    header: "Status page",
    skeleton: <BadgeSkeleton />,
    cell: (service) => <VisibilityBadge isPublic={service.isPublic} />,
  },
];

export const ServicesTable = ({
  services,
}: {
  services: readonly Service[];
}) => (
  <DataTable
    columns={columns}
    rows={services}
    getRowId={(service) => service.id}
    emptyState={
      <EmptyState
        icon={LayersIcon}
        title="No services"
        description="Group monitors and webhooks into services to see their combined health and share it on a status page."
        action={<NewServiceButton />}
      />
    }
  />
);

export const ServicesTableSkeleton = ({ rows }: { rows?: number }) => (
  <DataTableSkeleton columns={columns} rows={rows} />
);

import type { ReportService } from "@pulse/contracts";
import { LayersIcon } from "lucide-react";
import { type DataTableColumn, DataTable } from "@/components/data/data-table";
import { StatusBadge } from "@/components/data/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatCount } from "@/lib/format/number";
import { slaStatusMeta } from "../report-meta";
import { UptimeAgainstSla } from "./report-monitors-table";

const columns: DataTableColumn<ReportService>[] = [
  {
    id: "name",
    header: "Service",
    className: "font-medium",
    cell: (service) => service.name,
  },
  {
    id: "monitors",
    header: "Monitors",
    className: "numeric",
    cell: (service) => formatCount(service.monitorCount),
  },
  {
    id: "uptime",
    header: "Uptime",
    cell: (service) => (
      <UptimeAgainstSla
        percent={service.uptimePercent}
        status={service.slaStatus}
      />
    ),
  },
  {
    id: "sla",
    header: "SLA",
    cell: (service) => <StatusBadge {...slaStatusMeta[service.slaStatus]} />,
  },
  {
    id: "checks",
    header: "Checks",
    className: "numeric",
    cell: (service) => formatCount(service.checks),
  },
  {
    id: "down",
    header: "Down",
    className: "numeric",
    cell: (service) => formatCount(service.downChecks),
  },
];

export const ReportServicesTable = ({
  services,
}: {
  services: readonly ReportService[];
}) => (
  <DataTable
    columns={columns}
    rows={services}
    getRowId={(service) => service.id}
    emptyState={
      <EmptyState
        icon={LayersIcon}
        title="No services"
        description="Assign monitors to a service to see grouped uptime."
      />
    }
  />
);

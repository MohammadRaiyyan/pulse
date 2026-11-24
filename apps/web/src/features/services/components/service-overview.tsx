import { useSuspenseQuery } from "@tanstack/react-query";
import { IncidentsTable } from "@/features/incidents/components/incidents-table";
import { serviceOverviewQuery } from "../api/service-resource";
import { ServiceMembersTable } from "./service-members-table";
import { UptimeBars } from "./uptime-bars";

type ServiceOverviewProps = { serviceId: string };

const useServiceOverview = (serviceId: string) =>
  useSuspenseQuery(serviceOverviewQuery(serviceId)).data;

export const ServiceUptime = ({ serviceId }: ServiceOverviewProps) => (
  <UptimeBars history={useServiceOverview(serviceId).uptime} />
);

export const ServiceMembers = ({ serviceId }: ServiceOverviewProps) => (
  <ServiceMembersTable overview={useServiceOverview(serviceId)} />
);

export const ServiceIncidents = ({ serviceId }: ServiceOverviewProps) => (
  <IncidentsTable
    incidents={useServiceOverview(serviceId).activeIncidents}
    view="active"
  />
);

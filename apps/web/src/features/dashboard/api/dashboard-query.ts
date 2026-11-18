import { endpoints } from "@pulse/contracts";
import { queryOptions } from "@tanstack/react-query";
import { incidentResource } from "@/features/incidents/api/incident-resource";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { refreshOnMutation } from "@/lib/query/meta";
import { createQueryKeys } from "@/lib/query/query-keys";
import { RECENT_INCIDENTS_LIMIT } from "../dashboard-constants";

const dashboardKeys = createQueryKeys("dashboard");

export const dashboardSummaryQuery = queryOptions({
  queryKey: dashboardKeys.detail("summary"),
  queryFn: () => callEndpoint(endpoints.dashboardSummary),
  staleTime: 0,
  meta: refreshOnMutation,
});

export const openIncidentsQuery = incidentResource.queries.list({
  status: "open",
  page: 1,
  pageSize: RECENT_INCIDENTS_LIMIT,
});

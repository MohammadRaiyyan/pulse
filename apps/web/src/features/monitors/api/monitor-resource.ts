import { endpoints, resources } from "@pulse/contracts";
import { createResource } from "@/lib/query/resource";
import { createSubListQuery } from "@/lib/query/sub-list-query";
import {
  CHECK_HISTORY_PAGE_SIZE,
  RESPONSE_CHART_SAMPLE_SIZE,
} from "../monitor-constants";

export const monitorResource = createResource(resources.monitors, "Monitor");

const monitorChecksQuery = createSubListQuery(
  monitorResource.keys,
  endpoints.listMonitorChecks,
  "checks",
);

export const monitorResponseChecksQuery = (id: string) =>
  monitorChecksQuery(id, { page: 1, pageSize: RESPONSE_CHART_SAMPLE_SIZE });

export const monitorCheckHistoryQuery = (id: string, page: number) =>
  monitorChecksQuery(id, { page, pageSize: CHECK_HISTORY_PAGE_SIZE });

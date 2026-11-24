import { pageQuerySchema } from "@pulse/contracts";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PagedQueryView } from "@/components/data/paged-query-view";
import { ChartSkeleton } from "@/components/skeleton/chart-skeleton";
import { guard } from "@/features/auth/guards";
import {
  monitorCheckHistoryQuery,
  monitorResource,
  monitorResponseChecksQuery,
} from "@/features/monitors/api/monitor-resource";
import {
  CheckHistoryTable,
  CheckHistoryTableSkeleton,
} from "@/features/monitors/components/check-history-table";
import { MonitorActions } from "@/features/monitors/components/monitor-actions";
import { MonitorDetailLayout } from "@/features/monitors/components/monitor-detail-layout";
import { MonitorReportLink } from "@/features/reports/components/monitor-report-link";
import { MonitorDetailSkeleton } from "@/features/monitors/components/monitor-detail-skeleton";
import { MonitorResponseTime } from "@/features/monitors/components/monitor-response-time";
import { MonitorStats } from "@/features/monitors/components/monitor-stats";
import { MonitorStateBadge } from "@/features/monitors/components/monitor-state-badge";
import { MonitorTarget } from "@/features/monitors/components/monitor-target";
import { CHECK_HISTORY_PAGE_SIZE } from "@/features/monitors/monitor-constants";

const MonitorDetailPage = () => {
  const { monitorId } = Route.useParams();
  const { page } = Route.useSearch();
  const { data: monitor } = useSuspenseQuery(
    monitorResource.queries.detail(monitorId),
  );

  return (
    <MonitorDetailLayout
      title={monitor.name}
      badge={<MonitorStateBadge monitor={monitor} />}
      actions={
        <>
          <MonitorReportLink monitorId={monitor.id} />
          <MonitorActions monitor={monitor} />
        </>
      }
      overview={
        <>
          <MonitorTarget monitor={monitor} />
          <MonitorStats monitor={monitor} />
        </>
      }
      responseTime={
        <Suspense fallback={<ChartSkeleton />}>
          <MonitorResponseTime monitorId={monitorId} />
        </Suspense>
      }
      history={
        <PagedQueryView
          params={page}
          query={(nextPage) => monitorCheckHistoryQuery(monitorId, nextPage)}
          fallback={
            <CheckHistoryTableSkeleton rows={CHECK_HISTORY_PAGE_SIZE} />
          }
        >
          {(checks) => <CheckHistoryTable checks={checks} />}
        </PagedQueryView>
      }
    />
  );
};

export const Route = createFileRoute("/_app/monitors/$monitorId/")({
  validateSearch: pageQuerySchema,
  beforeLoad: guard("monitor:read"),
  loaderDeps: ({ search }) => search,
  loader: ({
    context: { queryClient },
    params: { monitorId },
    deps: { page },
  }) => {
    void queryClient.prefetchQuery(monitorResponseChecksQuery(monitorId));
    void queryClient.prefetchQuery(monitorCheckHistoryQuery(monitorId, page));

    return queryClient.ensureQueryData(
      monitorResource.queries.detail(monitorId),
    );
  },
  pendingComponent: MonitorDetailSkeleton,
  component: MonitorDetailPage,
});

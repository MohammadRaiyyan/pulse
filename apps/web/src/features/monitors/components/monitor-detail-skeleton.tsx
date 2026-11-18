import { ActionsSkeleton } from "@/components/skeleton/actions-skeleton";
import { BadgeSkeleton } from "@/components/skeleton/badge-skeleton";
import { ChartSkeleton } from "@/components/skeleton/chart-skeleton";
import { TextSkeleton } from "@/components/skeleton/text-skeleton";
import { TitleSkeleton } from "@/components/skeleton/title-skeleton";
import { CHECK_HISTORY_PAGE_SIZE } from "../monitor-constants";
import { CheckHistoryTableSkeleton } from "./check-history-table";
import { MonitorDetailLayout } from "./monitor-detail-layout";
import { MonitorStatsSkeleton } from "./monitor-stats";

export const MonitorDetailSkeleton = () => (
  <MonitorDetailLayout
    title={<TitleSkeleton />}
    badge={<BadgeSkeleton />}
    actions={<ActionsSkeleton count={3} />}
    overview={
      <>
        <TextSkeleton className="w-72" />
        <MonitorStatsSkeleton />
      </>
    }
    responseTime={<ChartSkeleton />}
    history={<CheckHistoryTableSkeleton rows={CHECK_HISTORY_PAGE_SIZE} />}
  />
);

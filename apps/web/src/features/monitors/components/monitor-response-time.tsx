import { useSuspenseQuery } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { ChartAreaSkeleton } from "@/components/skeleton/chart-skeleton";
import { monitorResponseChecksQuery } from "../api/monitor-resource";
import { CheckStrip } from "./check-strip";

const ResponseTimeChart = lazy(() =>
  import("./response-time-chart").then((module) => ({
    default: module.ResponseTimeChart,
  })),
);

export const MonitorResponseTime = ({ monitorId }: { monitorId: string }) => {
  const { data: checks } = useSuspenseQuery(
    monitorResponseChecksQuery(monitorId),
  );

  return (
    <>
      <CheckStrip checks={checks.items} />
      <Suspense fallback={<ChartAreaSkeleton />}>
        <ResponseTimeChart checks={checks.items} />
      </Suspense>
    </>
  );
};

import type { Report, ReportQuery } from "@pulse/contracts";
import { Button } from "@pulse/ui/components/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { type ReactNode, Suspense, lazy, useDeferredValue } from "react";
import { StaleContent } from "@/components/data/stale-content";
import { ContentSection } from "@/components/layout/content-section";
import { ChartAreaSkeleton } from "@/components/skeleton/chart-skeleton";
import { reportQuery } from "../api/report-api";
import { formatFullDay } from "../report-meta";
import {
  ReportMonitorsTable,
  ReportMonitorsTableSkeleton,
} from "./report-monitors-table";
import { ReportServicesTable } from "./report-services-table";
import {
  ReportSummaryStats,
  ReportSummaryStatsSkeleton,
} from "./report-summary-stats";

const DailyUptimeChart = lazy(() =>
  import("./report-charts").then((module) => ({
    default: module.DailyUptimeChart,
  })),
);

const DailyResponseChart = lazy(() =>
  import("./report-charts").then((module) => ({
    default: module.DailyResponseChart,
  })),
);

const describeRange = ({ range }: Report) =>
  `${formatFullDay(range.from)} – ${formatFullDay(range.to)} (UTC), ${range.days} ${range.days === 1 ? "day" : "days"}`;

const MonitorFilterNote = ({ report }: { report: Report }) =>
  report.monitor ? (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Showing</span>
      <Link
        to="/monitors/$monitorId"
        params={{ monitorId: report.monitor.id }}
        className="font-medium underline-offset-4 hover:underline"
      >
        {report.monitor.name}
      </Link>
      <Button variant="ghost" size="sm" asChild>
        <Link
          to="/reports"
          search={(previous) => ({ ...previous, monitorId: undefined })}
        >
          <XIcon data-icon="inline-start" />
          All monitors
        </Link>
      </Button>
    </div>
  ) : null;

const ChartsGrid = ({
  uptime,
  response,
  description,
}: {
  uptime: ReactNode;
  response: ReactNode;
  description: string;
}) => (
  <div className="grid gap-4 xl:grid-cols-2">
    <ContentSection
      title="Daily uptime"
      description={`${description}. Degraded checks count as up.`}
    >
      {uptime}
    </ContentSection>
    <ContentSection
      title="Daily response time"
      description={`${description}. Average of every check that day.`}
    >
      {response}
    </ContentSection>
  </div>
);

const ReportBody = ({ report }: { report: Report }) => (
  <>
    <MonitorFilterNote report={report} />
    <ReportSummaryStats report={report} />
    <ChartsGrid
      description={describeRange(report)}
      uptime={
        <Suspense fallback={<ChartAreaSkeleton />}>
          <DailyUptimeChart daily={report.daily} slaTarget={report.slaTarget} />
        </Suspense>
      }
      response={
        <Suspense fallback={<ChartAreaSkeleton />}>
          <DailyResponseChart daily={report.daily} />
        </Suspense>
      }
    />
    <ContentSection
      title="Monitors"
      description="Uptime is colored against the SLA target. Downtime is estimated from critical incident durations, clipped to the range."
    >
      <ReportMonitorsTable monitors={report.monitors} />
    </ContentSection>
    {report.services.length > 0 ? (
      <ContentSection
        title="Services"
        description="Uptime across each service's monitors, weighted by number of checks."
      >
        <ReportServicesTable services={report.services} />
      </ContentSection>
    ) : null}
  </>
);

const LoadedReport = ({ query }: { query: ReportQuery }) => {
  const deferredQuery = useDeferredValue(query);
  const { data: report } = useSuspenseQuery(reportQuery(deferredQuery));

  return (
    <StaleContent isStale={deferredQuery !== query}>
      <ReportBody report={report} />
    </StaleContent>
  );
};

export const ReportSkeleton = () => (
  <div className="flex flex-col gap-4" aria-busy aria-label="Loading report">
    <ReportSummaryStatsSkeleton />
    <ChartsGrid
      description="Loading"
      uptime={<ChartAreaSkeleton />}
      response={<ChartAreaSkeleton />}
    />
    <ContentSection title="Monitors" description="Loading">
      <ReportMonitorsTableSkeleton />
    </ContentSection>
  </div>
);

export const ReportView = ({ query }: { query: ReportQuery }) => (
  <Suspense fallback={<ReportSkeleton />}>
    <LoadedReport query={query} />
  </Suspense>
);

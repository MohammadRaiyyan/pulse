import type { DashboardSummary } from "@pulse/contracts";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import {
  ActivityIcon,
  GaugeIcon,
  HeartPulseIcon,
  SirenIcon,
} from "lucide-react";
import {
  type StatDefinition,
  StatCards,
  StatCardsSkeleton,
} from "@/components/data/stat-cards";
import {
  formatCount,
  formatMilliseconds,
  formatPercent,
} from "@/lib/format/number";
import { dashboardSummaryQuery } from "../api/dashboard-query";

const summaryStats: readonly StatDefinition<DashboardSummary>[] = [
  {
    label: "Monitors up",
    icon: ActivityIcon,
    tone: ({ monitors }) => (monitors.byStatus.down > 0 ? "danger" : "success"),
    value: ({ monitors }) =>
      `${formatCount(monitors.byStatus.up)} / ${formatCount(monitors.total)}`,
    hint: ({ monitors }) =>
      `${formatCount(monitors.byStatus.down)} down · ${formatCount(monitors.byStatus.degraded)} degraded · ${formatCount(monitors.paused)} paused`,
  },
  {
    label: "Active incidents",
    icon: SirenIcon,
    tone: ({ activeIncidents, criticalIncidents }) => {
      if (criticalIncidents > 0) {
        return "danger";
      }

      return activeIncidents > 0 ? "warning" : "neutral";
    },
    value: ({ activeIncidents }) => formatCount(activeIncidents),
    hint: ({ openIncidents, webhooks }) =>
      `${formatCount(openIncidents)} unacknowledged · ${formatCount(webhooks.byStatus.silent)} of ${formatCount(webhooks.total)} webhooks silent`,
  },
  {
    label: "Avg response time",
    icon: GaugeIcon,
    tone: () => "info",
    value: ({ averageResponseTimeMs }) =>
      formatMilliseconds(averageResponseTimeMs),
    hint: () => "Across active monitors",
  },
  {
    label: "Uptime",
    icon: HeartPulseIcon,
    tone: () => "success",
    value: ({ uptimePercent }) => formatPercent(uptimePercent),
    hint: () => "Last 24 hours",
  },
];

const LoadedSummaryStats = () => {
  const { data: summary } = useSuspenseQuery(dashboardSummaryQuery);

  return <StatCards definitions={summaryStats} data={summary} />;
};

export const SummaryStats = () => (
  <Suspense fallback={<StatCardsSkeleton definitions={summaryStats} />}>
    <LoadedSummaryStats />
  </Suspense>
);

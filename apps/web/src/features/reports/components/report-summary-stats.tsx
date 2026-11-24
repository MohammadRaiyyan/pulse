import type { Report } from "@pulse/contracts";
import {
  ActivityIcon,
  BellRingIcon,
  GaugeIcon,
  HeartPulseIcon,
  ShieldCheckIcon,
  SirenIcon,
  TimerOffIcon,
  WrenchIcon,
} from "lucide-react";
import {
  type StatDefinition,
  StatCards,
  StatCardsSkeleton,
} from "@/components/data/stat-cards";
import {
  formatCount,
  formatDuration,
  formatMilliseconds,
  formatPercent,
} from "@/lib/format/number";
import { formatUptime, slaStatusMeta } from "../report-meta";

const countMeetingSla = ({ monitors }: Report) =>
  monitors.filter((monitor) => monitor.slaStatus === "met").length;

const countWithData = ({ monitors }: Report) =>
  monitors.filter((monitor) => monitor.slaStatus !== "no_data").length;

const reportStats: readonly StatDefinition<Report>[] = [
  {
    label: "Uptime",
    icon: HeartPulseIcon,
    tone: ({ summary }) => slaStatusMeta[summary.slaStatus].tone,
    value: ({ summary }) => formatUptime(summary.uptimePercent),
    hint: ({ summary, slaTarget }) =>
      `${slaStatusMeta[summary.slaStatus].label} · target ${formatPercent(slaTarget)}`,
  },
  {
    label: "Avg response time",
    icon: GaugeIcon,
    tone: () => "info",
    value: ({ summary }) => formatMilliseconds(summary.averageResponseTimeMs),
    hint: () => "Mean of every check in the range",
  },
  {
    label: "Checks",
    icon: ActivityIcon,
    value: ({ summary }) => formatCount(summary.checks),
    hint: ({ summary }) =>
      `${formatCount(summary.downChecks)} down · ${formatCount(summary.degradedChecks)} degraded`,
  },
  {
    label: "Monitors meeting SLA",
    icon: ShieldCheckIcon,
    tone: (report) =>
      countMeetingSla(report) < countWithData(report) ? "warning" : "success",
    value: (report) =>
      `${formatCount(countMeetingSla(report))} / ${formatCount(countWithData(report))}`,
    hint: ({ monitors }) =>
      `Monitors with checks, out of ${formatCount(monitors.length)}`,
  },
  {
    label: "Incidents",
    icon: SirenIcon,
    tone: ({ summary }) =>
      summary.incidents.critical > 0 ? "danger" : "neutral",
    value: ({ summary }) => formatCount(summary.incidents.total),
    hint: ({ summary }) =>
      `${formatCount(summary.incidents.critical)} critical · ${formatCount(summary.incidents.warning)} warning`,
  },
  {
    label: "Mean time to acknowledge",
    icon: BellRingIcon,
    value: ({ summary }) => formatDuration(summary.mttaSeconds),
    hint: () => "Incidents started in the range",
  },
  {
    label: "Mean time to resolve",
    icon: WrenchIcon,
    value: ({ summary }) => formatDuration(summary.mttrSeconds),
    hint: () => "Incidents started in the range",
  },
  {
    label: "Downtime",
    icon: TimerOffIcon,
    tone: ({ summary }) => (summary.downtimeSeconds > 0 ? "danger" : "neutral"),
    value: ({ summary }) => formatDuration(summary.downtimeSeconds),
    hint: () => "Estimated from critical monitor incidents",
  },
];

export const ReportSummaryStats = ({ report }: { report: Report }) => (
  <StatCards definitions={reportStats} data={report} />
);

export const ReportSummaryStatsSkeleton = () => (
  <StatCardsSkeleton definitions={reportStats} />
);

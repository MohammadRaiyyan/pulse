import type { Monitor } from "@pulse/contracts";
import { ClockIcon, GaugeIcon, HeartPulseIcon, TimerIcon } from "lucide-react";
import {
  type StatDefinition,
  StatCards,
  StatCardsSkeleton,
} from "@/components/data/stat-cards";
import { formatRelativeTime } from "@/lib/format/date";
import {
  formatDuration,
  formatMilliseconds,
  formatPercent,
} from "@/lib/format/number";
import { getUptimeTone } from "../monitor-meta";

const monitorStats: readonly StatDefinition<Monitor>[] = [
  {
    label: "Uptime",
    icon: HeartPulseIcon,
    tone: ({ uptimePercent }) => getUptimeTone(uptimePercent),
    value: ({ uptimePercent }) => formatPercent(uptimePercent),
  },
  {
    label: "Last response",
    icon: GaugeIcon,
    tone: () => "info",
    value: ({ lastResponseTimeMs }) => formatMilliseconds(lastResponseTimeMs),
  },
  {
    label: "Check interval",
    icon: TimerIcon,
    value: ({ intervalSeconds }) => formatDuration(intervalSeconds),
    hint: ({ timeoutMs }) => `Timeout ${formatMilliseconds(timeoutMs)}`,
  },
  {
    label: "Last checked",
    icon: ClockIcon,
    value: ({ lastCheckedAt }) => formatRelativeTime(lastCheckedAt),
    hint: ({ expectedStatusCode }) => `Expects HTTP ${expectedStatusCode}`,
  },
];

export const MonitorStats = ({ monitor }: { monitor: Monitor }) => (
  <StatCards definitions={monitorStats} data={monitor} />
);

export const MonitorStatsSkeleton = () => (
  <StatCardsSkeleton definitions={monitorStats} />
);

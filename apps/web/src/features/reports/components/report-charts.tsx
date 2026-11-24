import type { ReportDayPoint } from "@pulse/contracts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@pulse/ui/components/chart";
import { ChartLineIcon } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatMilliseconds } from "@/lib/format/number";
import { formatDay } from "../report-meta";

const UPTIME_FILL_ID = "report-uptime-fill";
const RESPONSE_FILL_ID = "report-response-fill";
const UPTIME_DECIMALS = 1000;

const uptimeConfig = {
  uptimePercent: { label: "Uptime (%)", color: "var(--chart-1)" },
} satisfies ChartConfig;

const responseConfig = {
  averageResponseTimeMs: {
    label: "Avg response time (ms)",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const toChartData = (daily: readonly ReportDayPoint[]) =>
  daily.map((point) => ({
    day: formatDay(point.day),
    uptimePercent:
      point.uptimePercent === null
        ? null
        : Math.floor(point.uptimePercent * UPTIME_DECIMALS) / UPTIME_DECIMALS,
    averageResponseTimeMs: point.averageResponseTimeMs,
  }));

const hasChecks = (daily: readonly ReportDayPoint[]) =>
  daily.some((point) => point.checks > 0);

const NoChecks = () => (
  <EmptyState
    icon={ChartLineIcon}
    title="No checks in this range"
    description="Daily figures appear here once monitors have run checks on these days."
  />
);

const Fill = ({ id, color }: { id: string; color: string }) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={0.35} />
      <stop offset="100%" stopColor={color} stopOpacity={0} />
    </linearGradient>
  </defs>
);

const formatPercentTick = (value: number) => `${value}%`;

type DailyUptimeChartProps = {
  daily: readonly ReportDayPoint[];
  slaTarget: number;
};

export const DailyUptimeChart = ({
  daily,
  slaTarget,
}: DailyUptimeChartProps) => {
  if (!hasChecks(daily)) {
    return <NoChecks />;
  }

  return (
    <ChartContainer config={uptimeConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={toChartData(daily)} margin={{ left: 0, right: 8 }}>
        <Fill id={UPTIME_FILL_ID} color="var(--color-uptimePercent)" />
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={formatPercentTick}
          domain={[
            (lowest: number) =>
              Math.max(0, Math.floor(Math.min(lowest, slaTarget) - 1)),
            100,
          ]}
          allowDataOverflow
        />
        <ReferenceLine
          y={slaTarget}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={{
            value: `SLA ${slaTarget}%`,
            position: "insideBottomRight",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="uptimePercent"
          type="monotone"
          fill={`url(#${UPTIME_FILL_ID})`}
          stroke="var(--color-uptimePercent)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
};

export const DailyResponseChart = ({
  daily,
}: {
  daily: readonly ReportDayPoint[];
}) => {
  if (!hasChecks(daily)) {
    return <NoChecks />;
  }

  return (
    <ChartContainer config={responseConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={toChartData(daily)} margin={{ left: 0, right: 8 }}>
        <Fill
          id={RESPONSE_FILL_ID}
          color="var(--color-averageResponseTimeMs)"
        />
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={72}
          tickFormatter={formatMilliseconds}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <Area
          dataKey="averageResponseTimeMs"
          type="monotone"
          fill={`url(#${RESPONSE_FILL_ID})`}
          stroke="var(--color-averageResponseTimeMs)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
};

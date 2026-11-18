import type { CheckResult } from "@pulse/contracts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@pulse/ui/components/chart";
import { ChartLineIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatTime } from "@/lib/format/date";
import { formatMilliseconds } from "@/lib/format/number";

const FILL_ID = "response-time-fill";

const chartConfig = {
  responseTimeMs: { label: "Response time (ms)", color: "var(--chart-1)" },
} satisfies ChartConfig;

const toChartData = (checks: readonly CheckResult[]) =>
  checks.toReversed().map((check) => ({
    time: formatTime(check.checkedAt),
    responseTimeMs: check.responseTimeMs,
  }));

export const ResponseTimeChart = ({
  checks,
}: {
  checks: readonly CheckResult[];
}) => {
  if (checks.length === 0) {
    return (
      <EmptyState
        icon={ChartLineIcon}
        title="No checks yet"
        description="Response times appear here after the first check runs."
      />
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
      <AreaChart data={toChartData(checks)} margin={{ left: 0, right: 8 }}>
        <defs>
          <linearGradient id={FILL_ID} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-responseTimeMs)"
              stopOpacity={0.35}
            />
            <stop
              offset="100%"
              stopColor="var(--color-responseTimeMs)"
              stopOpacity={0}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="time"
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
          dataKey="responseTimeMs"
          type="monotone"
          fill={`url(#${FILL_ID})`}
          stroke="var(--color-responseTimeMs)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
};

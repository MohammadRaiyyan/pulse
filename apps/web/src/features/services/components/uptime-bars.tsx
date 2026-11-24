import type { UptimeDay, UptimeHistory } from "@pulse/contracts";
import { cn } from "@pulse/ui/lib/utils";
import { type StatusTone, toneStyles } from "@/components/data/tones";
import { formatPercent } from "@/lib/format/number";

const HEALTHY_DAY_PERCENT = 99.9;
const WARNING_DAY_PERCENT = 99;

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeZone: "UTC",
});

const getDayTone = (percent: number | null): StatusTone => {
  if (percent === null) {
    return "neutral";
  }

  if (percent >= HEALTHY_DAY_PERCENT) {
    return "success";
  }

  return percent >= WARNING_DAY_PERCENT ? "warning" : "danger";
};

const describeDay = ({ date, uptimePercent }: UptimeDay) =>
  `${dayFormatter.format(new Date(`${date}T00:00:00Z`))} · ${
    uptimePercent === null ? "No data" : `${formatPercent(uptimePercent)} uptime`
  }`;

export const UptimeBars = ({ history }: { history: UptimeHistory }) => (
  <div className="flex flex-col gap-2">
    <ol
      className="flex h-8 items-stretch gap-px sm:gap-[2px]"
      aria-label="Daily uptime"
    >
      {history.days.map((day) => (
        <li
          key={day.date}
          title={describeDay(day)}
          aria-label={describeDay(day)}
          className={cn(
            "min-w-0 flex-1 rounded-[2px] transition-transform hover:scale-y-110",
            toneStyles[getDayTone(day.uptimePercent)].solid,
          )}
        />
      ))}
    </ol>
    <div className="flex justify-between gap-2 font-mono text-[11px] text-muted-foreground">
      <span>{history.days.length} days ago</span>
      <span>
        {history.uptimePercent === null
          ? "No data"
          : `${formatPercent(history.uptimePercent)} uptime`}
      </span>
      <span>Today</span>
    </div>
  </div>
);

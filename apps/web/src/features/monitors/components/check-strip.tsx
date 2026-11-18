import type { CheckResult } from "@pulse/contracts";
import { cn } from "@pulse/ui/lib/utils";
import { toneStyles } from "@/components/data/tones";
import { formatDateTime } from "@/lib/format/date";
import { formatMilliseconds } from "@/lib/format/number";
import { monitorStatusMeta } from "../monitor-meta";

const describeCheck = (check: CheckResult) =>
  `${monitorStatusMeta[check.outcome].label} · ${formatMilliseconds(check.responseTimeMs)} · ${formatDateTime(check.checkedAt)}`;

export const CheckStrip = ({ checks }: { checks: readonly CheckResult[] }) => (
  <div className="flex flex-col gap-2">
    <ol
      className="flex h-8 items-stretch gap-[3px]"
      aria-label="Recent check outcomes"
    >
      {checks.toReversed().map((check) => (
        <li
          key={check.id}
          title={describeCheck(check)}
          aria-label={describeCheck(check)}
          className={cn(
            "flex-1 rounded-[2px] transition-transform hover:scale-y-110",
            toneStyles[monitorStatusMeta[check.outcome].tone].solid,
          )}
        />
      ))}
    </ol>
    <div className="flex justify-between font-mono text-[11px] text-muted-foreground">
      <span>{checks.length} checks ago</span>
      <span>now</span>
    </div>
  </div>
);

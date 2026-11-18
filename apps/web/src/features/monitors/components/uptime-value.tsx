import { cn } from "@pulse/ui/lib/utils";
import { toneStyles } from "@/components/data/tones";
import { formatPercent } from "@/lib/format/number";
import { getUptimeTone } from "../monitor-meta";

export const UptimeValue = ({ percent }: { percent: number | null }) => (
  <span
    className={cn(
      "numeric font-medium",
      toneStyles[getUptimeTone(percent)].text,
    )}
  >
    {formatPercent(percent)}
  </span>
);

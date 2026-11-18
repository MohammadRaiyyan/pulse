import { Badge } from "@pulse/ui/components/badge";
import { cn } from "@pulse/ui/lib/utils";
import { LiveDot } from "./live-dot";
import { type StatusMeta, toneStyles } from "./tones";

export const StatusBadge = ({ label, tone }: StatusMeta) => (
  <Badge
    variant="outline"
    className={cn(
      "gap-1.5 border-transparent font-medium",
      toneStyles[tone].soft,
    )}
  >
    <LiveDot isLive={tone === "danger"} />
    {label}
  </Badge>
);

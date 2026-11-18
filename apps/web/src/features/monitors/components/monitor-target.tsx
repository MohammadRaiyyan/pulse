import type { Monitor } from "@pulse/contracts";
import { MethodBadge } from "@/components/data/method-badge";

export const MonitorTarget = ({
  monitor,
}: {
  monitor: Pick<Monitor, "method" | "url">;
}) => (
  <span className="flex min-w-0 items-center gap-2">
    <MethodBadge method={monitor.method} />
    <span className="truncate font-mono text-xs text-muted-foreground">
      {monitor.url}
    </span>
  </span>
);

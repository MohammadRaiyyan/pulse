import { cn } from "@pulse/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LiveDot } from "@/components/data/live-dot";
import { toneStyles } from "@/components/data/tones";
import { dashboardSummaryQuery } from "../api/dashboard-query";
import { getSystemHealth } from "../system-health";

export const SystemStatusPill = () => {
  const { data: summary } = useQuery(dashboardSummaryQuery);

  if (!summary) {
    return null;
  }

  const health = getSystemHealth(summary);

  return (
    <Link
      to="/incidents"
      search={{ status: "open" }}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80",
        toneStyles[health.tone].soft,
      )}
    >
      <LiveDot isLive />
      {health.title}
    </Link>
  );
};

import type { DashboardSummary } from "@pulse/contracts";
import type { StatusTone } from "@/components/data/tones";
import { pluralize } from "@/lib/format/text";

type SystemHealth = {
  tone: StatusTone;
  title: string;
};

export const getSystemHealth = ({
  activeIncidents,
  criticalIncidents,
  monitors,
}: DashboardSummary): SystemHealth => {
  if (activeIncidents > 0) {
    return {
      tone: criticalIncidents > 0 ? "danger" : "warning",
      title: pluralize(activeIncidents, "active incident"),
    };
  }

  if (monitors.byStatus.degraded > 0) {
    return { tone: "warning", title: "Degraded performance" };
  }

  return { tone: "success", title: "All systems operational" };
};

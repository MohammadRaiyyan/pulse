import type { DashboardSummary } from "@pulse/contracts";
import type { StatusTone } from "@/components/data/tones";
import { pluralize } from "@/lib/format/text";

type SystemHealth = {
  tone: StatusTone;
  title: string;
};

export const getSystemHealth = ({
  openIncidents,
  monitors,
}: DashboardSummary): SystemHealth => {
  if (openIncidents > 0) {
    return {
      tone: "danger",
      title: pluralize(openIncidents, "open incident"),
    };
  }

  if (monitors.byStatus.degraded > 0) {
    return { tone: "warning", title: "Degraded performance" };
  }

  return { tone: "success", title: "All systems operational" };
};

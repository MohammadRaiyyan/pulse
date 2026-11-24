import { SidebarMenuBadge } from "@pulse/ui/components/sidebar";
import { cn } from "@pulse/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { dashboardSummaryQuery } from "../api/dashboard-query";

export const ActiveIncidentsBadge = () => {
  const { data: summary } = useQuery(dashboardSummaryQuery);

  if (!summary?.activeIncidents) {
    return null;
  }

  return (
    <SidebarMenuBadge
      className={cn(
        "rounded-sm font-mono text-[11px] text-white",
        summary.criticalIncidents > 0 ? "bg-destructive/90" : "bg-warning/90",
      )}
    >
      {summary.activeIncidents}
    </SidebarMenuBadge>
  );
};

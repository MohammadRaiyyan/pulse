import { SidebarMenuBadge } from "@pulse/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { dashboardSummaryQuery } from "../api/dashboard-query";

export const OpenIncidentsBadge = () => {
  const { data: summary } = useQuery(dashboardSummaryQuery);

  if (!summary?.openIncidents) {
    return null;
  }

  return (
    <SidebarMenuBadge className="rounded-sm bg-destructive/90 font-mono text-[11px] text-white">
      {summary.openIncidents}
    </SidebarMenuBadge>
  );
};

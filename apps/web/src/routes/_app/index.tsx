import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import {
  dashboardSummaryQuery,
  activeIncidentsQuery,
} from "@/features/dashboard/api/dashboard-query";
import { ActiveIncidentsCard } from "@/features/dashboard/components/active-incidents-card";
import { SummaryStats } from "@/features/dashboard/components/summary-stats";
import { getFirstName } from "@/lib/format/text";

const DashboardPage = () => {
  const user = useCurrentUser();

  return (
    <Page title={`Hi, ${getFirstName(user.name)}`} summary={<SummaryStats />}>
      <ActiveIncidentsCard />
    </Page>
  );
};

export const Route = createFileRoute("/_app/")({
  beforeLoad: guard("monitor:read"),
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(dashboardSummaryQuery);
    void queryClient.prefetchQuery(activeIncidentsQuery);
  },
  component: DashboardPage,
});

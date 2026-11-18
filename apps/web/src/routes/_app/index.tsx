import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import {
  dashboardSummaryQuery,
  openIncidentsQuery,
} from "@/features/dashboard/api/dashboard-query";
import { OpenIncidentsCard } from "@/features/dashboard/components/open-incidents-card";
import { SummaryStats } from "@/features/dashboard/components/summary-stats";
import { getFirstName } from "@/lib/format/text";

const DashboardPage = () => {
  const user = useCurrentUser();

  return (
    <Page title={`Hi, ${getFirstName(user.name)}`} summary={<SummaryStats />}>
      <OpenIncidentsCard />
    </Page>
  );
};

export const Route = createFileRoute("/_app/")({
  beforeLoad: guard("monitor:read"),
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(dashboardSummaryQuery);
    void queryClient.prefetchQuery(openIncidentsQuery);
  },
  component: DashboardPage,
});

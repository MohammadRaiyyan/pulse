import { Button } from "@pulse/ui/components/button";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { Link } from "@tanstack/react-router";
import {
  ContentSection,
  SectionActions,
} from "@/components/layout/content-section";
import {
  IncidentsTable,
  IncidentsTableSkeleton,
} from "@/features/incidents/components/incidents-table";
import { activeIncidentsQuery } from "../api/dashboard-query";
import { RECENT_INCIDENTS_LIMIT } from "../dashboard-constants";

const ActiveIncidentsTable = () => {
  const { data } = useSuspenseQuery(activeIncidentsQuery);

  return <IncidentsTable incidents={data.items} view="active" />;
};

export const ActiveIncidentsCard = () => (
  <ContentSection
    title="Active incidents"
    description="Issues that still need attention"
  >
    <SectionActions>
      <Button variant="ghost-accent" asChild>
        <Link to="/incidents" search={{ status: "active" }}>
          View all
        </Link>
      </Button>
    </SectionActions>
    <Suspense
      fallback={<IncidentsTableSkeleton rows={RECENT_INCIDENTS_LIMIT} />}
    >
      <ActiveIncidentsTable />
    </Suspense>
  </ContentSection>
);

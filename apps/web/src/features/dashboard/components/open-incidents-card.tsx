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
import { openIncidentsQuery } from "../api/dashboard-query";
import { RECENT_INCIDENTS_LIMIT } from "../dashboard-constants";

const OpenIncidentsTable = () => {
  const { data } = useSuspenseQuery(openIncidentsQuery);

  return <IncidentsTable incidents={data.items} />;
};

export const OpenIncidentsCard = () => (
  <ContentSection
    title="Open incidents"
    description="Issues that still need attention"
  >
    <SectionActions>
      <Button variant="ghost-accent" asChild>
        <Link to="/incidents" search={{ status: "open" }}>
          View all
        </Link>
      </Button>
    </SectionActions>
    <Suspense
      fallback={<IncidentsTableSkeleton rows={RECENT_INCIDENTS_LIMIT} />}
    >
      <OpenIncidentsTable />
    </Suspense>
  </ContentSection>
);

import { UPTIME_HISTORY_DAYS } from "@pulse/contracts";
import type { ReactNode } from "react";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";

type ServiceDetailLayoutProps = {
  title: ReactNode;
  badge: ReactNode;
  actions: ReactNode;
  details: ReactNode;
  uptime: ReactNode;
  members: ReactNode;
  incidents: ReactNode;
};

export const ServiceDetailLayout = ({
  title,
  badge,
  actions,
  details,
  uptime,
  members,
  incidents,
}: ServiceDetailLayoutProps) => (
  <Page title={title} badge={badge} actions={actions}>
    <ContentSection
      title="Overview"
      description="Status is the worst state among active members."
    >
      {details}
    </ContentSection>
    <ContentSection
      title="Uptime"
      description={`Daily uptime of member monitors over the last ${UPTIME_HISTORY_DAYS} days (UTC).`}
    >
      {uptime}
    </ContentSection>
    <ContentSection
      title="Members"
      description="Monitors and webhook endpoints that make up this service."
    >
      {members}
    </ContentSection>
    <ContentSection
      title="Active incidents"
      description="Open and acknowledged incidents of member monitors and webhooks."
    >
      {incidents}
    </ContentSection>
  </Page>
);

import type { ReactNode } from "react";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";

type WebhookDetailLayoutProps = {
  title: ReactNode;
  badge: ReactNode;
  actions: ReactNode;
  details: ReactNode;
  events: ReactNode;
};

export const WebhookDetailLayout = ({
  title,
  badge,
  actions,
  details,
  events,
}: WebhookDetailLayoutProps) => (
  <Page title={title} badge={badge} actions={actions}>
    <ContentSection
      title="Endpoint"
      description="Where to send events and when to alert."
    >
      {details}
    </ContentSection>
    <ContentSection title="Received events" description="Most recent first">
      {events}
    </ContentSection>
  </Page>
);

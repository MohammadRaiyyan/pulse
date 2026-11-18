import type { ReactNode } from "react";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { RESPONSE_CHART_SAMPLE_SIZE } from "../monitor-constants";

type MonitorDetailLayoutProps = {
  title: ReactNode;
  badge: ReactNode;
  actions: ReactNode;
  overview: ReactNode;
  responseTime: ReactNode;
  history: ReactNode;
};

export const MonitorDetailLayout = ({
  title,
  badge,
  actions,
  overview,
  responseTime,
  history,
}: MonitorDetailLayoutProps) => (
  <Page title={title} badge={badge} actions={actions}>
    <ContentSection
      title="Overview"
      description="Current health and configuration of this check."
    >
      {overview}
    </ContentSection>
    <ContentSection
      title="Response time"
      description={`Last ${RESPONSE_CHART_SAMPLE_SIZE} checks`}
    >
      {responseTime}
    </ContentSection>
    <ContentSection
      title="Check history"
      description="Every check result, newest first."
    >
      {history}
    </ContentSection>
  </Page>
);

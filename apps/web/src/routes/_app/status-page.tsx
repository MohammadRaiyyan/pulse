import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { SpinnerFallback } from "@/components/feedback/spinner-fallback";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { statusPageSettingsQuery } from "@/features/status-page/api/status-page-api";
import { StatusPageSettingsForm } from "@/features/status-page/components/status-page-settings-form";

const StatusPageSettingsPage = () => (
  <Page title="Status page">
    <ContentSection
      title="Public status page"
      description="Share the health of public services at /status. Mark services as public on the Services page."
    >
      <Suspense fallback={<SpinnerFallback />}>
        <StatusPageSettingsForm />
      </Suspense>
    </ContentSection>
  </Page>
);

export const Route = createFileRoute("/_app/status-page")({
  beforeLoad: guard("status-page:manage"),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(statusPageSettingsQuery);
  },
  component: StatusPageSettingsPage,
});

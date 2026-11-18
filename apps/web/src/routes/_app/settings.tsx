import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { connectionsQuery } from "@/features/account/api/account-api";
import { ChangePasswordForm } from "@/features/account/components/change-password-form";
import {
  ConnectedAccounts,
  ConnectedAccountsSkeleton,
} from "@/features/account/components/connected-accounts";
import { ProfileForm } from "@/features/account/components/profile-form";
import { SignOutEverywhere } from "@/features/account/components/sign-out-everywhere";

const SettingsPage = () => (
  <Page title="Account settings">
    <ContentSection title="Profile" description="How you appear to your team.">
      <ProfileForm />
    </ContentSection>
    <ContentSection
      title="Password"
      description="Use a strong password you do not reuse elsewhere."
    >
      <ChangePasswordForm />
    </ContentSection>
    <ContentSection
      title="Connected accounts"
      description="Sign in faster with GitHub or Google."
    >
      <Suspense fallback={<ConnectedAccountsSkeleton />}>
        <ConnectedAccounts />
      </Suspense>
    </ContentSection>
    <ContentSection
      title="Sessions"
      description="Manage where you are signed in."
    >
      <SignOutEverywhere />
    </ContentSection>
  </Page>
);

export const Route = createFileRoute("/_app/settings")({
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(connectionsQuery);
  },
  component: SettingsPage,
});

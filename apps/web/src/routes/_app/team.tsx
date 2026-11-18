import { hasPermission, paginationQuerySchema } from "@pulse/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { PagedQueryView } from "@/components/data/paged-query-view";
import { ContentSection } from "@/components/layout/content-section";
import { Page } from "@/components/layout/page";
import { guard } from "@/features/auth/guards";
import { pendingInvitationsQuery } from "@/features/team/api/invitation-resource";
import { memberResource } from "@/features/team/api/member-resource";
import { InviteMemberButton } from "@/features/team/components/invite-member-button";
import {
  TeamTable,
  TeamTableSkeleton,
} from "@/features/team/components/team-table";

const FIRST_PAGE = 1;

const TeamPage = () => {
  const search = Route.useSearch();

  return (
    <Page title="Team" actions={<InviteMemberButton />}>
      <ContentSection
        title="Members"
        description="Everyone with access to this workspace, including pending invitations."
      >
        <PagedQueryView
          fallback={<TeamTableSkeleton />}
          params={search}
          query={memberResource.queries.list}
        >
          {(members, { page }) => (
            <TeamTable
              members={members}
              includeInvitations={page === FIRST_PAGE}
            />
          )}
        </PagedQueryView>
      </ContentSection>
    </Page>
  );
};

export const Route = createFileRoute("/_app/team")({
  validateSearch: paginationQuerySchema,
  beforeLoad: guard("member:read"),
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient, user }, deps }) => {
    if (deps.page === FIRST_PAGE && hasPermission(user.role, "member:manage")) {
      void queryClient.prefetchQuery(pendingInvitationsQuery);
    }

    void queryClient.prefetchQuery(memberResource.queries.list(deps));
  },
  component: TeamPage,
});

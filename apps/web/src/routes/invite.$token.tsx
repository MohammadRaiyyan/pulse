import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AuthErrorPage } from "@/app/shell/auth-error-page";
import { AuthShell } from "@/app/shell/auth-layout";
import { AuthCard } from "@/features/auth/components/auth-card";
import { invitationPreviewQuery } from "@/features/team/api/invitation-resource";
import { AcceptInvitationForm } from "@/features/team/components/accept-invitation-form";
import { roleMeta } from "@/features/team/role-meta";
import { formatRelativeTime } from "@/lib/format/date";

const InvitePage = () => {
  const { token } = Route.useParams();
  const { data: invitation } = useSuspenseQuery(invitationPreviewQuery(token));

  return (
    <AuthShell>
      <AuthCard
        title="Join the workspace"
        description={`${invitation.invitedBy.name} invited you to join as ${roleMeta[invitation.role].label}.`}
        footer={
          <p>
            This invitation expires {formatRelativeTime(invitation.expiresAt)}.
          </p>
        }
      >
        <AcceptInvitationForm token={token} email={invitation.email} />
      </AuthCard>
    </AuthShell>
  );
};

export const Route = createFileRoute("/invite/$token")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(invitationPreviewQuery(params.token)),
  component: InvitePage,
  errorComponent: AuthErrorPage,
});

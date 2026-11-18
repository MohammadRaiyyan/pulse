import type { Invitation } from "@pulse/contracts";
import { RowActions } from "@/components/actions/row-actions";
import { CopyButton } from "@/components/data/copy-button";
import { RevokeInvitationButton } from "./revoke-invitation-button";

export const InvitationActions = ({
  invitation,
}: {
  invitation: Invitation;
}) => (
  <RowActions>
    <CopyButton value={invitation.inviteUrl} label="Invite link" />
    <RevokeInvitationButton invitation={invitation} />
  </RowActions>
);

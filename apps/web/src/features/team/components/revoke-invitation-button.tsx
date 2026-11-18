import type { Invitation } from "@pulse/contracts";
import { XCircleIcon } from "lucide-react";
import { DeleteResourceButton } from "@/components/actions/delete-resource-button";
import { invitationResource } from "../api/invitation-resource";

export const RevokeInvitationButton = ({
  invitation,
}: {
  invitation: Invitation;
}) => (
  <DeleteResourceButton
    resource={invitationResource}
    id={invitation.id}
    name={`the invitation for ${invitation.email}`}
    verb="Revoke"
    icon={XCircleIcon}
    consequence={`The link sent to ${invitation.email} will stop working immediately.`}
    successMessage={`Invitation for ${invitation.email} revoked`}
    iconOnly
  />
);

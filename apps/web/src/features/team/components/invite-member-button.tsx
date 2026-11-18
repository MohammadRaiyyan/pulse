import { INVITATION_TTL_DAYS } from "@pulse/contracts";
import { MailPlusIcon } from "lucide-react";
import { CreateButton } from "@/components/actions/create-button";
import { CreateResourceDialog } from "@/components/dialogs/create-resource-dialog";
import { Can } from "@/features/auth/components/can";
import { invitationResource } from "../api/invitation-resource";
import { defaultInvitationInput } from "../invitation-defaults";
import { InviteForm } from "./invite-form";

export const InviteMemberButton = () => (
  <Can permission="member:manage">
    <CreateResourceDialog
      resource={invitationResource}
      form={InviteForm}
      defaultValues={defaultInvitationInput}
      title="Invite a teammate"
      description={`They get a link to join this workspace. It expires in ${INVITATION_TTL_DAYS} days.`}
      submitLabel="Send invite"
      successMessage={(invitation) => `Invitation sent to ${invitation.email}`}
      trigger={<CreateButton label="Invite member" icon={MailPlusIcon} />}
    />
  </Can>
);

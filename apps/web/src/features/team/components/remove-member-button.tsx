import type { User } from "@pulse/contracts";
import { UserMinusIcon } from "lucide-react";
import { DeleteResourceButton } from "@/components/actions/delete-resource-button";
import { memberResource } from "../api/member-resource";

export const RemoveMemberButton = ({ member }: { member: User }) => (
  <DeleteResourceButton
    resource={memberResource}
    id={member.id}
    name={member.name}
    verb="Remove"
    icon={UserMinusIcon}
    consequence="They will immediately lose access to this workspace."
    successMessage={`${member.name} removed`}
    iconOnly
  />
);

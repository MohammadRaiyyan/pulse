import type { User } from "@pulse/contracts";
import { useCanManageMember } from "../hooks/use-can-manage-member";
import { RemoveMemberButton } from "./remove-member-button";
import { RoleBadge } from "./role-badge";
import { RoleSelect } from "./role-select";

type MemberCellProps = { member: User };

export const MemberRoleCell = ({ member }: MemberCellProps) =>
  useCanManageMember(member) ? (
    <RoleSelect member={member} />
  ) : (
    <RoleBadge value={member.role} />
  );

export const MemberActionsCell = ({ member }: MemberCellProps) =>
  useCanManageMember(member) ? <RemoveMemberButton member={member} /> : null;

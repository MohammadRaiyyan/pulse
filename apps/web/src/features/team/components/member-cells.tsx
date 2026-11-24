import type { User } from "@pulse/contracts";
import { useCanManageMember } from "../hooks/use-can-manage-member";
import { useCanTransferOwnership } from "../hooks/use-can-transfer-ownership";
import { RemoveMemberButton } from "./remove-member-button";
import { RoleBadge } from "./role-badge";
import { RoleSelect } from "./role-select";
import { TransferOwnershipButton } from "./transfer-ownership-button";

type MemberCellProps = { member: User };

export const MemberRoleCell = ({ member }: MemberCellProps) =>
  useCanManageMember(member) ? (
    <RoleSelect member={member} />
  ) : (
    <RoleBadge value={member.role} />
  );

export const MemberActionsCell = ({ member }: MemberCellProps) => {
  const canManage = useCanManageMember(member);
  const canTransfer = useCanTransferOwnership(member);

  return (
    <div className="flex justify-end gap-1">
      {canTransfer ? <TransferOwnershipButton member={member} /> : null}
      {canManage ? <RemoveMemberButton member={member} /> : null}
    </div>
  );
};

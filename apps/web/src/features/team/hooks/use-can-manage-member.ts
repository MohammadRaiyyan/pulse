import type { User } from "@pulse/contracts";
import { useCan } from "@/features/auth/hooks/use-can";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";

export const useCanManageMember = (member: User) => {
  const currentUser = useCurrentUser();
  const canManageMembers = useCan("member:manage");

  return (
    canManageMembers && member.role !== "owner" && member.id !== currentUser.id
  );
};

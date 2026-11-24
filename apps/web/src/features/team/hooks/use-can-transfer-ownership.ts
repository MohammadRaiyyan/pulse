import type { User } from "@pulse/contracts";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";

export const useCanTransferOwnership = (member: User) => {
  const currentUser = useCurrentUser();

  return currentUser.role === "owner" && member.id !== currentUser.id;
};

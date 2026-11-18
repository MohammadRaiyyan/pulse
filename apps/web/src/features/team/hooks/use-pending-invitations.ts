import { useQuery } from "@tanstack/react-query";
import { useCan } from "@/features/auth/hooks/use-can";
import { pendingInvitationsQuery } from "../api/invitation-resource";

export const usePendingInvitations = (isIncluded: boolean) => {
  const isEnabled = useCan("member:manage") && isIncluded;
  const { data } = useQuery({ ...pendingInvitationsQuery, enabled: isEnabled });

  return isEnabled ? (data?.items ?? []) : [];
};

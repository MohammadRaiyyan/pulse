import type { User } from "@pulse/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { endSession, setSessionUser, startSession } from "../session";

export const useSessionActions = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const context = { queryClient, router };

  return {
    start: (user: User) => startSession(context, user),
    setUser: (user: User) => setSessionUser(queryClient, user),
    end: () => endSession(context),
  };
};

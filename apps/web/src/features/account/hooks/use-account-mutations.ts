import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSessionActions } from "@/features/auth/hooks/use-session-actions";
import { providerMeta } from "@/features/auth/provider-meta";
import { inlineErrors } from "@/lib/query/meta";
import { accountApi, connectionsQuery } from "../api/account-api";

export const useUpdateProfile = () => {
  const session = useSessionActions();
  const router = useRouter();

  return useMutation({
    mutationFn: accountApi.updateProfile,
    onSuccess: async (user) => {
      session.setUser(user);
      toast.success("Profile updated");
      await router.invalidate();
    },
    meta: inlineErrors,
  });
};

export const useChangePassword = () =>
  useMutation({
    mutationFn: accountApi.changePassword,
    onSuccess: () => toast.success("Password changed"),
    meta: inlineErrors,
  });

export const useSignOutEverywhere = () => {
  const session = useSessionActions();

  return useMutation({
    mutationFn: accountApi.signOutEverywhere,
    onSuccess: async () => {
      toast.success("Signed out of all devices");
      await session.end();
    },
  });
};

export const useDisconnectProvider = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: accountApi.disconnect,
    onSuccess: async (_, provider) => {
      toast.success(`${providerMeta[provider].label} disconnected`);
      await queryClient.invalidateQueries({
        queryKey: connectionsQuery.queryKey,
      });
    },
  });
};

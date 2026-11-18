import type { OAuthAuthorizeInput, OAuthProvider } from "@pulse/contracts";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { inlineErrors } from "@/lib/query/meta";
import { authApi } from "../api/auth-api";
import { useSessionActions } from "./use-session-actions";

export const useLogin = () => {
  const session = useSessionActions();

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: session.start,
    meta: inlineErrors,
  });
};

export const useRegister = () => {
  const session = useSessionActions();

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: session.start,
    meta: inlineErrors,
  });
};

export const useAcceptInvitation = () => {
  const session = useSessionActions();
  const router = useRouter();

  return useMutation({
    mutationFn: authApi.acceptInvitation,
    onSuccess: async (user) => {
      session.setUser(user);
      await router.navigate({ to: "/" });
    },
    meta: inlineErrors,
  });
};

type StartOAuthVariables = {
  provider: OAuthProvider;
  input: OAuthAuthorizeInput;
};

export const useStartOAuth = () =>
  useMutation({
    mutationFn: ({ provider, input }: StartOAuthVariables) =>
      authApi.authorizeOAuth(provider, input),
    onSuccess: ({ authorizationUrl }) =>
      window.location.assign(authorizationUrl),
  });

export const useForgotPassword = () =>
  useMutation({ mutationFn: authApi.forgotPassword, meta: inlineErrors });

export const useResetPassword = () =>
  useMutation({ mutationFn: authApi.resetPassword, meta: inlineErrors });

export const useLogout = () => {
  const session = useSessionActions();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: session.end,
  });
};

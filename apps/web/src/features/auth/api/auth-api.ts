import {
  type AcceptInvitationInput,
  type AuthResponse,
  type ForgotPasswordInput,
  type LoginInput,
  type OAuthAuthorizeInput,
  type OAuthCallbackInput,
  type OAuthProvider,
  type RegisterInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
  endpoints,
} from "@pulse/contracts";
import { queryOptions } from "@tanstack/react-query";
import { clearAccessToken, setAccessToken } from "@/lib/api/access-token";
import { callEndpoint } from "@/lib/api/call-endpoint";

const establishSession = ({ accessToken, user }: AuthResponse) => {
  setAccessToken(accessToken);

  return user;
};

const sessionPost = async (request: Promise<AuthResponse>) =>
  establishSession(await request);

export const authApi = {
  login: (body: LoginInput) =>
    sessionPost(callEndpoint(endpoints.login, { body })),
  register: (body: RegisterInput) =>
    sessionPost(callEndpoint(endpoints.register, { body })),
  acceptInvitation: (body: AcceptInvitationInput) =>
    sessionPost(callEndpoint(endpoints.acceptInvitation, { body })),
  forgotPassword: (body: ForgotPasswordInput) =>
    callEndpoint(endpoints.forgotPassword, { body }),
  resetPassword: (body: ResetPasswordInput) =>
    callEndpoint(endpoints.resetPassword, { body }),
  verifyEmail: (body: VerifyEmailInput) =>
    callEndpoint(endpoints.verifyEmail, { body }),
  authorizeOAuth: (provider: OAuthProvider, body: OAuthAuthorizeInput) =>
    callEndpoint(endpoints.authorizeOAuth, { params: { provider }, body }),
  completeOAuth: async (provider: OAuthProvider, body: OAuthCallbackInput) => {
    const { redirectTo, ...session } = await callEndpoint(
      endpoints.completeOAuth,
      { params: { provider }, body },
    );

    return { user: establishSession(session), redirectTo };
  },
  logout: async () => {
    try {
      await callEndpoint(endpoints.logout);
    } finally {
      clearAccessToken();
    }
  },
};

export const authConfigQuery = queryOptions({
  queryKey: ["auth-config"],
  queryFn: () => callEndpoint(endpoints.authConfig),
  staleTime: 5 * 60_000,
});

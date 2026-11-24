import {
  type ChangePasswordInput,
  type OAuthProvider,
  type UpdateProfileInput,
  endpoints,
} from "@pulse/contracts";
import { queryOptions } from "@tanstack/react-query";
import { callEndpoint } from "@/lib/api/call-endpoint";
import { createQueryKeys } from "@/lib/query/query-keys";

export const accountKeys = createQueryKeys("account");

export const accountApi = {
  updateProfile: (body: UpdateProfileInput) =>
    callEndpoint(endpoints.updateProfile, { body }),
  changePassword: (body: ChangePasswordInput) =>
    callEndpoint(endpoints.changePassword, { body }),
  resendEmailVerification: () =>
    callEndpoint(endpoints.resendEmailVerification),
  signOutEverywhere: () => callEndpoint(endpoints.logoutEverywhere),
  disconnect: (provider: OAuthProvider) =>
    callEndpoint(endpoints.disconnectProvider, { params: { provider } }),
};

export const connectionsQuery = queryOptions({
  queryKey: accountKeys.detail("connections"),
  queryFn: () => callEndpoint(endpoints.listConnections),
});

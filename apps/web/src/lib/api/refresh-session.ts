import { type User, endpoints } from "@pulse/contracts";
import { setAccessToken } from "./access-token";
import { executeRequest } from "./transport";

const { method, path, response } = endpoints.refreshSession;

let pendingRefresh: Promise<User> | null = null;

const requestRefresh = async () => {
  const { accessToken, user } = await executeRequest(method, path, {
    schema: response,
  });

  setAccessToken(accessToken);

  return user;
};

export const refreshSession = () => {
  pendingRefresh ??= requestRefresh().finally(() => {
    pendingRefresh = null;
  });

  return pendingRefresh;
};

import type { ApiMethod } from "@pulse/contracts";
import { z } from "zod";
import { clearAccessToken } from "./access-token";
import { refreshSession } from "./refresh-session";
import { notifySessionExpired } from "./session-events";
import { type RequestOptions, executeRequest } from "./transport";

export const emptyResponseSchema = z.undefined();

const createHttpClient =
  (onUnauthorized?: () => Promise<boolean>) =>
  <TSchema extends z.ZodType>(
    method: ApiMethod,
    path: string,
    options: RequestOptions<TSchema>,
  ) =>
    executeRequest(method, path, options, onUnauthorized);

export const recoverSession = async () => {
  try {
    await refreshSession();
    return true;
  } catch {
    clearAccessToken();
    notifySessionExpired();
    return false;
  }
};

export const http = createHttpClient(recoverSession);

export const publicHttp = createHttpClient();

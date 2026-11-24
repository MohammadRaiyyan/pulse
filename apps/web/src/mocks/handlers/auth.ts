import { endpoints, oauthProviderSchema } from "@pulse/contracts";
import { db } from "../db";
import { createRateLimiter } from "../lib/rate-limit";
import { noContent, errorResponse } from "../lib/responses";
import { route } from "../lib/route";
import {
  authResponse,
  clearedSession,
  readRefreshUser,
  withSession,
} from "../lib/session";
import { findUserByEmail, verifyPassword } from "../lib/users";

const authConfig = route(endpoints.authConfig, ({ respond }) =>
  respond({
    signupOpen: db.users.size === 0,
    oauthProviders: oauthProviderSchema.options,
  }),
);

const limitLoginAttempts = createRateLimiter({ limit: 5, windowMs: 60_000 });

const login = route(endpoints.login, ({ body, respond }) => {
  limitLoginAttempts(body.email);
  const user = findUserByEmail(body.email);

  if (!user || !verifyPassword(user.id, body.password)) {
    return errorResponse("UNAUTHORIZED", "Invalid email or password");
  }

  return respond(authResponse(user), withSession(user));
});

const register = route(endpoints.register, () =>
  errorResponse(
    "FORBIDDEN",
    "Pulse is invite-only. Ask a workspace admin to send you an invitation.",
  ),
);

const verifyEmail = route(endpoints.verifyEmail, () => noContent());

const refreshSession = route(
  endpoints.refreshSession,
  ({ cookies, respond }) => {
    const user = readRefreshUser(cookies);

    if (!user) {
      return errorResponse("UNAUTHORIZED", "Session expired", {
        headers: clearedSession,
      });
    }

    return respond(authResponse(user), withSession(user));
  },
);

const logout = route(endpoints.logout, () => noContent(clearedSession));

const logoutEverywhere = route(endpoints.logoutEverywhere, () =>
  noContent(clearedSession),
);

export const authHandlers = [
  authConfig,
  login,
  register,
  verifyEmail,
  refreshSession,
  logout,
  logoutEverywhere,
];

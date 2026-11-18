import { DEFAULT_SIGNUP_ROLE, endpoints } from "@pulse/contracts";
import { createRateLimiter } from "../lib/rate-limit";
import { noContent, errorResponse } from "../lib/responses";
import { route } from "../lib/route";
import {
  authResponse,
  clearedSession,
  readRefreshUser,
  withSession,
} from "../lib/session";
import { createUser, findUserByEmail, verifyPassword } from "../lib/users";

const limitLoginAttempts = createRateLimiter({ limit: 5, windowMs: 60_000 });

const login = route(endpoints.login, ({ body, respond }) => {
  limitLoginAttempts(body.email);
  const user = findUserByEmail(body.email);

  if (!user || !verifyPassword(user.id, body.password)) {
    return errorResponse("UNAUTHORIZED", "Invalid email or password");
  }

  return respond(authResponse(user), withSession(user));
});

const register = route(endpoints.register, ({ body, respond }) => {
  const user = createUser({ ...body, role: DEFAULT_SIGNUP_ROLE });

  return respond(authResponse(user), withSession(user, 201));
});

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
  login,
  register,
  refreshSession,
  logout,
  logoutEverywhere,
];

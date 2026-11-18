import type { AuthResponse, User } from "@pulse/contracts";
import type { HttpResponseInit } from "msw";
import { db } from "../db";
import { issueAccessToken } from "./auth";

const REFRESH_COOKIE_NAME = "pulse_refresh";
const REFRESH_COOKIE_MAX_AGE_SECONDS = 604_800;
const COOKIE_ATTRIBUTES = "Path=/; SameSite=Lax";

const refreshCookie = (userId: string) =>
  `${REFRESH_COOKIE_NAME}=${userId}; ${COOKIE_ATTRIBUTES}; Max-Age=${REFRESH_COOKIE_MAX_AGE_SECONDS}`;

export const clearedSession = {
  "Set-Cookie": `${REFRESH_COOKIE_NAME}=; ${COOKIE_ATTRIBUTES}; Max-Age=0`,
};

export const readRefreshUser = (cookies: Record<string, string>) => {
  const userId = cookies[REFRESH_COOKIE_NAME];

  return userId ? db.users.get(userId) : undefined;
};

export const authResponse = (user: User): AuthResponse => ({
  accessToken: issueAccessToken(user.id),
  user,
});

export const withSession = (user: User, status = 200): HttpResponseInit => ({
  status,
  headers: { "Set-Cookie": refreshCookie(user.id) },
});

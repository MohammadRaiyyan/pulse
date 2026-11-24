import type { Request, Response } from "express";
import { useSecureCookies } from "../config/env.ts";

const REFRESH_COOKIE = "pulse_refresh";
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: useSecureCookies,
  sameSite: "lax",
  path: "/api/auth",
} as const;

export const readRefreshCookie = (req: Request): string | undefined => {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];

  return typeof value === "string" && value.length > 0 ? value : undefined;
};

export const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
};

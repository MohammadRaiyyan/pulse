import type { OAuthProvider } from "@pulse/contracts";
import type { Request, Response } from "express";
import { isProduction } from "../config/env.ts";

const OAUTH_NONCE_COOKIE = "pulse_oauth_nonce";
export const OAUTH_NONCE_TTL_SECONDS = 600;

const cookieOptionsFor = (provider: OAuthProvider) =>
  ({
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: `/api/auth/oauth/${provider}/callback`,
  }) as const;

export const readOAuthNonceCookie = (req: Request): string | undefined => {
  const value: unknown = req.cookies?.[OAUTH_NONCE_COOKIE];

  return typeof value === "string" && value.length > 0 ? value : undefined;
};

export const setOAuthNonceCookie = (
  res: Response,
  provider: OAuthProvider,
  nonce: string,
) => {
  res.cookie(OAUTH_NONCE_COOKIE, nonce, {
    ...cookieOptionsFor(provider),
    maxAge: OAUTH_NONCE_TTL_SECONDS * 1000,
  });
};

export const clearOAuthNonceCookie = (
  res: Response,
  provider: OAuthProvider,
) => {
  res.clearCookie(OAUTH_NONCE_COOKIE, cookieOptionsFor(provider));
};

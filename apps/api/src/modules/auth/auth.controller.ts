import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "@pulse/contracts";
import type { Request, Response } from "express";
import { unauthorized } from "../../lib/errors.ts";
import { validate } from "../../lib/validate.ts";
import { currentUser } from "../../middleware/authenticate.ts";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "../../security/refresh-cookie.ts";
import * as authService from "./auth.service.ts";
import * as emailVerificationService from "./email-verification.service.ts";

const sendSession = (
  res: Response,
  session: authService.SignedInSession,
  status = 200,
) => {
  setRefreshCookie(res, session.refreshToken);
  res
    .status(status)
    .json({ accessToken: session.accessToken, user: session.user });
};

export const getConfig = async (_req: Request, res: Response) => {
  res.json(await authService.getAuthConfig());
};

export const register = async (req: Request, res: Response) => {
  const input = validate(registerSchema, req.body);
  const session = await authService.register(input);
  sendSession(res, session, 201);
};

export const login = async (req: Request, res: Response) => {
  const input = validate(loginSchema, req.body);
  const session = await authService.login(input);
  sendSession(res, session);
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = readRefreshCookie(req);
  const session = refreshToken ? await authService.refresh(refreshToken) : null;

  if (!session) {
    clearRefreshCookie(res);
    throw unauthorized("Session expired");
  }

  sendSession(res, session);
};

export const logout = async (req: Request, res: Response) => {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
};

export const logoutEverywhere = async (req: Request, res: Response) => {
  await authService.logoutEverywhere(currentUser(req).id);
  clearRefreshCookie(res);
  res.status(204).end();
};

export const forgotPassword = async (req: Request, res: Response) => {
  const input = validate(forgotPasswordSchema, req.body);
  await authService.requestPasswordReset(input.email);
  res.status(204).end();
};

export const resetPassword = async (req: Request, res: Response) => {
  const input = validate(resetPasswordSchema, req.body);
  await authService.resetPassword(input);
  res.status(204).end();
};

export const verifyEmail = async (req: Request, res: Response) => {
  const input = validate(verifyEmailSchema, req.body);
  await emailVerificationService.verifyEmail(input.token);
  res.status(204).end();
};

import {
  changePasswordSchema,
  oauthProviderSchema,
  updateProfileSchema,
} from "@pulse/contracts";
import type { Request, Response } from "express";
import { validate, validateParam } from "../../lib/validate.ts";
import { currentUser } from "../../middleware/authenticate.ts";
import { setRefreshCookie } from "../../security/refresh-cookie.ts";
import * as accountService from "./account.service.ts";

export const updateProfile = async (req: Request, res: Response) => {
  const input = validate(updateProfileSchema, req.body);
  res.json(await accountService.updateProfile(currentUser(req), input));
};

export const changePassword = async (req: Request, res: Response) => {
  const input = validate(changePasswordSchema, req.body);
  const session = await accountService.changePassword(currentUser(req), input);

  setRefreshCookie(res, session.refreshToken);
  res.status(204).end();
};

export const listConnections = async (req: Request, res: Response) => {
  res.json(await accountService.getConnections(currentUser(req)));
};

export const disconnectProvider = async (req: Request, res: Response) => {
  const provider = validateParam(
    oauthProviderSchema,
    req.params.provider,
    "provider",
  );
  await accountService.disconnectProvider(currentUser(req), provider);
  res.status(204).end();
};

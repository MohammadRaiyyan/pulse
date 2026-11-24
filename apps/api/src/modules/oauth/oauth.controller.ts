import {
  oauthAuthorizeSchema,
  oauthCallbackSchema,
  oauthProviderSchema,
} from "@pulse/contracts";
import type { Request, Response } from "express";
import { validate, validateParam } from "../../lib/validate.ts";
import { authenticateRequest } from "../../middleware/authenticate.ts";
import { setRefreshCookie } from "../../security/refresh-cookie.ts";
import * as oauthService from "./oauth.service.ts";

export const authorize = async (req: Request, res: Response) => {
  const provider = validateParam(
    oauthProviderSchema,
    req.params.provider,
    "provider",
  );
  const input = validate(oauthAuthorizeSchema, req.body);
  const user = input.intent === "link" ? await authenticateRequest(req) : null;

  const authorizationUrl = await oauthService.createAuthorizationUrl(
    provider,
    input.intent,
    input.redirectTo,
    user ? user.id : null,
  );

  res.json({ authorizationUrl });
};

export const callback = async (req: Request, res: Response) => {
  const provider = validateParam(
    oauthProviderSchema,
    req.params.provider,
    "provider",
  );
  const input = validate(oauthCallbackSchema, req.body);
  const session = await oauthService.completeOAuth(provider, input);

  setRefreshCookie(res, session.refreshToken);
  res.json({
    accessToken: session.accessToken,
    user: session.user,
    redirectTo: session.redirectTo,
  });
};

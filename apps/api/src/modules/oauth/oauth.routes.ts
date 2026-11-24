import { Router } from "express";
import { byIp, rateLimit } from "../../middleware/rate-limit.ts";
import * as oauthController from "./oauth.controller.ts";

const oauthLimit = rateLimit({
  name: "oauth",
  limit: 20,
  windowSeconds: 60,
  key: byIp,
});

export const oauthRouter = Router();

oauthRouter.post(
  "/auth/oauth/:provider/authorize",
  oauthLimit,
  oauthController.authorize,
);
oauthRouter.post(
  "/auth/oauth/:provider/callback",
  oauthLimit,
  oauthController.callback,
);

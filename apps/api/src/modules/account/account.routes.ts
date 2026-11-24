import { Router } from "express";
import { requireAuth } from "../../middleware/authenticate.ts";
import { byUser, rateLimit } from "../../middleware/rate-limit.ts";
import * as accountController from "./account.controller.ts";

const resendVerificationLimit = rateLimit({
  name: "resend-verification",
  limit: 3,
  windowSeconds: 600,
  key: byUser,
});

export const accountRouter = Router();

accountRouter.patch("/me", requireAuth, accountController.updateProfile);
accountRouter.post(
  "/me/password",
  requireAuth,
  accountController.changePassword,
);
accountRouter.get(
  "/me/connections",
  requireAuth,
  accountController.listConnections,
);
accountRouter.delete(
  "/me/connections/:provider",
  requireAuth,
  accountController.disconnectProvider,
);
accountRouter.post(
  "/me/email/verification",
  requireAuth,
  resendVerificationLimit,
  accountController.resendEmailVerification,
);

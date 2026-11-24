import { Router } from "express";
import { requireAuth } from "../../middleware/authenticate.ts";
import * as accountController from "./account.controller.ts";

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

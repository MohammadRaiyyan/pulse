import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import * as webhookController from "./webhook.controller.ts";

const canRead = requirePermission("webhook:read");
const canWrite = requirePermission("webhook:write");

export const webhookRouter = Router();

webhookRouter.get("/webhooks", requireAuth, canRead, webhookController.list);
webhookRouter.get(
  "/webhooks/:id",
  requireAuth,
  canRead,
  webhookController.getOne,
);
webhookRouter.post(
  "/webhooks",
  requireAuth,
  canWrite,
  webhookController.create,
);
webhookRouter.patch(
  "/webhooks/:id",
  requireAuth,
  canWrite,
  webhookController.update,
);
webhookRouter.delete(
  "/webhooks/:id",
  requireAuth,
  canWrite,
  webhookController.remove,
);
webhookRouter.get(
  "/webhooks/:id/events",
  requireAuth,
  canRead,
  webhookController.listEvents,
);

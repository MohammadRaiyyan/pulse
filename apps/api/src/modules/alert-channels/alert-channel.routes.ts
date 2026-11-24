import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import * as alertChannelController from "./alert-channel.controller.ts";

const canRead = requirePermission("alert-channel:read");
const canWrite = requirePermission("alert-channel:write");

export const alertChannelRouter = Router();

alertChannelRouter.get(
  "/alert-channels",
  requireAuth,
  canRead,
  alertChannelController.list,
);
alertChannelRouter.get(
  "/alert-channels/:id",
  requireAuth,
  canRead,
  alertChannelController.getOne,
);
alertChannelRouter.post(
  "/alert-channels",
  requireAuth,
  canWrite,
  alertChannelController.create,
);
alertChannelRouter.patch(
  "/alert-channels/:id",
  requireAuth,
  canWrite,
  alertChannelController.update,
);
alertChannelRouter.delete(
  "/alert-channels/:id",
  requireAuth,
  canWrite,
  alertChannelController.remove,
);
alertChannelRouter.post(
  "/alert-channels/:id/test",
  requireAuth,
  canWrite,
  alertChannelController.sendTest,
);
alertChannelRouter.get(
  "/alert-channels/:id/deliveries",
  requireAuth,
  canRead,
  alertChannelController.listDeliveries,
);
alertChannelRouter.get(
  "/alert-channels/:id/signing-secret",
  requireAuth,
  canWrite,
  alertChannelController.getSigningSecret,
);
alertChannelRouter.post(
  "/alert-channels/:id/signing-secret/rotate",
  requireAuth,
  canWrite,
  alertChannelController.rotateSigningSecret,
);

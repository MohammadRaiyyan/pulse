import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import { byIp, rateLimit } from "../../middleware/rate-limit.ts";
import * as invitationController from "./invitation.controller.ts";

const canManage = requirePermission("member:manage");
const publicInvitationLimit = rateLimit({
  name: "invitation-public",
  limit: 30,
  windowSeconds: 60,
  key: byIp,
});

export const invitationRouter = Router();

invitationRouter.get(
  "/invitations/preview/:token",
  publicInvitationLimit,
  invitationController.preview,
);
invitationRouter.post(
  "/invitations/accept",
  publicInvitationLimit,
  invitationController.accept,
);

invitationRouter.get(
  "/invitations",
  requireAuth,
  canManage,
  invitationController.list,
);
invitationRouter.get(
  "/invitations/:id",
  requireAuth,
  canManage,
  invitationController.getOne,
);
invitationRouter.post(
  "/invitations",
  requireAuth,
  canManage,
  invitationController.create,
);
invitationRouter.delete(
  "/invitations/:id",
  requireAuth,
  canManage,
  invitationController.revoke,
);

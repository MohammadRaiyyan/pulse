import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import { byUser, rateLimit } from "../../middleware/rate-limit.ts";
import * as memberController from "./member.controller.ts";

const canRead = requirePermission("member:read");
const canManage = requirePermission("member:manage");

const transferOwnershipLimit = rateLimit({
  name: "transfer-ownership",
  limit: 20,
  windowSeconds: 600,
  key: byUser,
});

export const memberRouter = Router();

memberRouter.get("/members", requireAuth, canRead, memberController.list);
memberRouter.get("/members/:id", requireAuth, canRead, memberController.getOne);
memberRouter.patch(
  "/members/:id",
  requireAuth,
  canManage,
  memberController.update,
);
memberRouter.delete(
  "/members/:id",
  requireAuth,
  canManage,
  memberController.remove,
);
memberRouter.post(
  "/members/:id/transfer-ownership",
  requireAuth,
  canManage,
  transferOwnershipLimit,
  memberController.transferOwnership,
);

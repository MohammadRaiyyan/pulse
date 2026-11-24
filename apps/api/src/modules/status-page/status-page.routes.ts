import { Router } from "express";
import { env } from "../../config/env.ts";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import { byIp, rateLimit } from "../../middleware/rate-limit.ts";
import * as statusPageController from "./status-page.controller.ts";

const canManage = requirePermission("status-page:manage");

const publicStatusLimit = rateLimit({
  name: "public-status",
  limit: env.PUBLIC_STATUS_RATE_LIMIT_PER_MINUTE,
  windowSeconds: 60,
  key: byIp,
});

export const statusPageRouter = Router();

statusPageRouter.get(
  "/status-page",
  requireAuth,
  canManage,
  statusPageController.getSettings,
);
statusPageRouter.patch(
  "/status-page",
  requireAuth,
  canManage,
  statusPageController.updateSettings,
);
statusPageRouter.get(
  "/public/status",
  publicStatusLimit,
  statusPageController.getPublicStatus,
);

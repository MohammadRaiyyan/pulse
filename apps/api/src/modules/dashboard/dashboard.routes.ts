import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import * as dashboardController from "./dashboard.controller.ts";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/dashboard/summary",
  requireAuth,
  requirePermission("monitor:read"),
  dashboardController.summary,
);

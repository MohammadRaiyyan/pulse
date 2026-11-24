import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import * as reportController from "./report.controller.ts";

const canRead = requirePermission("monitor:read");

export const reportRouter = Router();

reportRouter.get("/reports", requireAuth, canRead, reportController.show);
reportRouter.get(
  "/reports/export",
  requireAuth,
  canRead,
  reportController.exportCsv,
);

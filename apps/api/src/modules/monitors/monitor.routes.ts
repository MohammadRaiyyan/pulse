import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import * as monitorController from "./monitor.controller.ts";

const canRead = requirePermission("monitor:read");
const canWrite = requirePermission("monitor:write");

export const monitorRouter = Router();

monitorRouter.get("/monitors", requireAuth, canRead, monitorController.list);
monitorRouter.get(
  "/monitors/:id",
  requireAuth,
  canRead,
  monitorController.getOne,
);
monitorRouter.post(
  "/monitors",
  requireAuth,
  canWrite,
  monitorController.create,
);
monitorRouter.patch(
  "/monitors/:id",
  requireAuth,
  canWrite,
  monitorController.update,
);
monitorRouter.delete(
  "/monitors/:id",
  requireAuth,
  canWrite,
  monitorController.remove,
);
monitorRouter.get(
  "/monitors/:id/checks",
  requireAuth,
  canRead,
  monitorController.listChecks,
);

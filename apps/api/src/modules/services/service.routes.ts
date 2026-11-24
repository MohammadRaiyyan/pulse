import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import * as serviceController from "./service.controller.ts";

const canRead = requirePermission("monitor:read");
const canWrite = requirePermission("monitor:write");

export const serviceRouter = Router();

serviceRouter.get("/services", requireAuth, canRead, serviceController.list);
serviceRouter.get(
  "/services/:id",
  requireAuth,
  canRead,
  serviceController.getOne,
);
serviceRouter.post(
  "/services",
  requireAuth,
  canWrite,
  serviceController.create,
);
serviceRouter.patch(
  "/services/:id",
  requireAuth,
  canWrite,
  serviceController.update,
);
serviceRouter.delete(
  "/services/:id",
  requireAuth,
  canWrite,
  serviceController.remove,
);
serviceRouter.get(
  "/services/:id/overview",
  requireAuth,
  canRead,
  serviceController.overview,
);

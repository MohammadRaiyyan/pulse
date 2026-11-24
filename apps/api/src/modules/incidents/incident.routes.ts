import { Router } from "express";
import {
  requireAuth,
  requirePermission,
} from "../../middleware/authenticate.ts";
import * as incidentController from "./incident.controller.ts";

const canRead = requirePermission("incident:read");
const canManage = requirePermission("incident:manage");

export const incidentRouter = Router();

incidentRouter.get("/incidents", requireAuth, canRead, incidentController.list);
incidentRouter.get(
  "/incidents/:id",
  requireAuth,
  canRead,
  incidentController.getOne,
);
incidentRouter.post(
  "/incidents/:id/:transition",
  requireAuth,
  canManage,
  incidentController.transition,
);

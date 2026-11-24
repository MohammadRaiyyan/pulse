import {
  incidentListQuerySchema,
  incidentTransitionSchema,
} from "@pulse/contracts";
import type { Request, Response } from "express";
import {
  validateId,
  validateParam,
  validateQuery,
} from "../../lib/validate.ts";
import * as incidentService from "./incident.service.ts";

const LABEL = "Incident";

export const list = async (req: Request, res: Response) => {
  const query = validateQuery(incidentListQuerySchema, req.query);
  res.json(await incidentService.getIncidents(query));
};

export const getOne = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  res.json(await incidentService.getIncident(id));
};

export const transition = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  const transitionName = validateParam(
    incidentTransitionSchema,
    req.params.transition,
    "transition",
  );
  res.json(await incidentService.transitionIncident(id, transitionName));
};

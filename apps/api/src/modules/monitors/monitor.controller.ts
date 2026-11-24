import {
  createMonitorSchema,
  monitorListQuerySchema,
  paginationQuerySchema,
  updateMonitorSchema,
} from "@pulse/contracts";
import type { Request, Response } from "express";
import { validate, validateId, validateQuery } from "../../lib/validate.ts";
import * as monitorService from "./monitor.service.ts";

const LABEL = "Monitor";

export const list = async (req: Request, res: Response) => {
  const query = validateQuery(monitorListQuerySchema, req.query);
  res.json(await monitorService.getMonitors(query));
};

export const getOne = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  res.json(await monitorService.getMonitor(id));
};

export const create = async (req: Request, res: Response) => {
  const input = validate(createMonitorSchema, req.body);
  res.status(201).json(await monitorService.createMonitor(input));
};

export const update = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  const input = validate(updateMonitorSchema, req.body);
  res.json(await monitorService.updateMonitorById(id, input));
};

export const remove = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  await monitorService.removeMonitor(id);
  res.status(204).end();
};

export const listChecks = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  const query = validateQuery(paginationQuerySchema, req.query);
  res.json(await monitorService.getMonitorChecks(id, query));
};

import {
  createServiceSchema,
  paginationQuerySchema,
  updateServiceSchema,
} from "@pulse/contracts";
import type { Request, Response } from "express";
import { validate, validateId, validateQuery } from "../../lib/validate.ts";
import * as serviceService from "./service.service.ts";

const LABEL = "Service";

export const list = async (req: Request, res: Response) => {
  const query = validateQuery(paginationQuerySchema, req.query);
  res.json(await serviceService.getServices(query));
};

export const getOne = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  res.json(await serviceService.getService(id));
};

export const create = async (req: Request, res: Response) => {
  const input = validate(createServiceSchema, req.body);
  res.status(201).json(await serviceService.createService(input));
};

export const update = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  const input = validate(updateServiceSchema, req.body);
  res.json(await serviceService.updateServiceById(id, input));
};

export const remove = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  await serviceService.removeService(id);
  res.status(204).end();
};

export const overview = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  res.json(await serviceService.getServiceOverview(id));
};

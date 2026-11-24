import {
  createAlertChannelSchema,
  paginationQuerySchema,
  updateAlertChannelSchema,
} from "@pulse/contracts";
import type { Request, Response } from "express";
import { validate, validateId, validateQuery } from "../../lib/validate.ts";
import * as alertChannelService from "./alert-channel.service.ts";

const LABEL = "Alert channel";

export const list = async (req: Request, res: Response) => {
  const query = validateQuery(paginationQuerySchema, req.query);
  res.json(await alertChannelService.getAlertChannels(query));
};

export const getOne = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  res.json(await alertChannelService.getAlertChannel(id));
};

export const create = async (req: Request, res: Response) => {
  const input = validate(createAlertChannelSchema, req.body);
  res.status(201).json(await alertChannelService.createAlertChannel(input));
};

export const update = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  const input = validate(updateAlertChannelSchema, req.body);
  res.json(await alertChannelService.updateAlertChannelById(id, input));
};

export const remove = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  await alertChannelService.removeAlertChannel(id);
  res.status(204).end();
};

export const sendTest = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  await alertChannelService.sendTestAlert(id);
  res.status(204).end();
};

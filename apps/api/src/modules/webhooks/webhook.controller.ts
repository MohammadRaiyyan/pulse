import {
  createWebhookSchema,
  paginationQuerySchema,
  updateWebhookSchema,
  webhookEventListQuerySchema,
} from "@pulse/contracts";
import type { Request, Response } from "express";
import { validate, validateId, validateQuery } from "../../lib/validate.ts";
import * as webhookService from "./webhook.service.ts";

const LABEL = "Webhook";

export const list = async (req: Request, res: Response) => {
  const query = validateQuery(paginationQuerySchema, req.query);
  res.json(await webhookService.getWebhooks(query));
};

export const getOne = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  res.json(await webhookService.getWebhook(id));
};

export const create = async (req: Request, res: Response) => {
  const input = validate(createWebhookSchema, req.body);
  res.status(201).json(await webhookService.createWebhook(input));
};

export const update = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  const input = validate(updateWebhookSchema, req.body);
  res.json(await webhookService.updateWebhookById(id, input));
};

export const remove = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  await webhookService.removeWebhook(id);
  res.status(204).end();
};

export const listEvents = async (req: Request, res: Response) => {
  const id = validateId(req.params.id, LABEL);
  const query = validateQuery(webhookEventListQuerySchema, req.query);
  res.json(await webhookService.getWebhookEvents(id, query));
};

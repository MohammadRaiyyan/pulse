import { updateStatusPageSettingsSchema } from "@pulse/contracts";
import type { Request, Response } from "express";
import { validate } from "../../lib/validate.ts";
import * as statusPageService from "./status-page.service.ts";

export const getSettings = async (_req: Request, res: Response) => {
  res.json(await statusPageService.getStatusPageSettings());
};

export const updateSettings = async (req: Request, res: Response) => {
  const input = validate(updateStatusPageSettingsSchema, req.body);
  res.json(await statusPageService.updateStatusPageSettings(input));
};

export const getPublicStatus = async (_req: Request, res: Response) => {
  res.json(await statusPageService.getPublicStatus());
};

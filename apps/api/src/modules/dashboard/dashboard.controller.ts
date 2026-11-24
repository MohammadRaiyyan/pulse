import type { Request, Response } from "express";
import * as dashboardService from "./dashboard.service.ts";

export const summary = async (_req: Request, res: Response) => {
  res.json(await dashboardService.getDashboardSummary());
};

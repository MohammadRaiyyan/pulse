import { reportQuerySchema } from "@pulse/contracts";
import type { Request, Response } from "express";
import { validateQuery } from "../../lib/validate.ts";
import * as reportService from "./report.service.ts";

export const show = async (req: Request, res: Response) => {
  const query = validateQuery(reportQuerySchema, req.query);
  res.json(await reportService.buildReport(query));
};

export const exportCsv = async (req: Request, res: Response) => {
  const query = validateQuery(reportQuerySchema, req.query);
  const { filename, body } = await reportService.buildReportCsv(query);

  res
    .status(200)
    .set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${filename}`,
      "Cache-Control": "no-store",
    })
    .send(body);
};

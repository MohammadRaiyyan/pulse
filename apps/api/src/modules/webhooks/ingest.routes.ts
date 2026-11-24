import express, { Router } from "express";
import { rateLimit } from "../../middleware/rate-limit.ts";
import * as ingestController from "./ingest.controller.ts";

const ingestLimit = rateLimit({
  name: "ingest",
  limit: 120,
  windowSeconds: 60,
  key: (req) => String(req.params.slug),
});

const readRawBody = express.text({ type: () => true, limit: "1mb" });

export const ingestRouter = Router();

ingestRouter.all("/:slug", ingestLimit, readRawBody, ingestController.receive);

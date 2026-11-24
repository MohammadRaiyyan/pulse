import express, { Router } from "express";
import { env } from "../../config/env.ts";
import { byIp, rateLimit } from "../../middleware/rate-limit.ts";
import * as ingestController from "./ingest.controller.ts";

const ingestPerIpLimit = rateLimit({
  name: "ingest-ip",
  limit: env.WEBHOOK_INGEST_PER_IP_PER_MINUTE,
  windowSeconds: 60,
  key: byIp,
});

const ingestPerSlugLimit = rateLimit({
  name: "ingest",
  limit: env.WEBHOOK_INGEST_PER_SLUG_PER_MINUTE,
  windowSeconds: 60,
  key: (req) => String(req.params.slug),
});

const readRawBody = express.text({
  type: () => true,
  limit: env.WEBHOOK_MAX_BODY_BYTES,
});

export const ingestRouter = Router();

ingestRouter.all(
  "/:slug",
  ingestPerIpLimit,
  ingestPerSlugLimit,
  readRawBody,
  ingestController.receive,
);

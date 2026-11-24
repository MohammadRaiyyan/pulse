import { createHash, timingSafeEqual } from "node:crypto";
import {
  type Request,
  type RequestHandler,
  type Response,
  Router,
} from "express";
import { env } from "../../config/env.ts";
import { unauthorized } from "../../lib/errors.ts";
import { metricsRegistry } from "./metrics.registry.ts";

const digest = (value: string) => createHash("sha256").update(value).digest();

const hasValidToken = (req: Request, expectedToken: string) => {
  const header = req.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return false;
  }

  return timingSafeEqual(digest(token), digest(expectedToken));
};

const requireMetricsToken =
  (expectedToken: string): RequestHandler =>
  (req, res, next) => {
    if (!hasValidToken(req, expectedToken)) {
      res.setHeader("WWW-Authenticate", 'Bearer realm="metrics"');
      throw unauthorized("A valid metrics token is required");
    }

    next();
  };

const metrics = async (_req: Request, res: Response) => {
  res.type(metricsRegistry.contentType).send(await metricsRegistry.metrics());
};

export const createMetricsRouter = (
  token: string | undefined = env.METRICS_TOKEN,
) => {
  const router = Router();

  if (token) {
    router.get("/metrics", requireMetricsToken(token), metrics);
  }

  return router;
};

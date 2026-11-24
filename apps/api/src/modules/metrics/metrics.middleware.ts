import type { RequestHandler } from "express";
import { httpRequestDuration, httpRequestsTotal } from "./metrics.registry.ts";

const UNMATCHED_ROUTE = "unmatched";

export const httpMetrics: RequestHandler = (req, res, next) => {
  const stopTimer = httpRequestDuration.startTimer();
  let routePattern = UNMATCHED_ROUTE;
  let matchedRoute: unknown;

  Object.defineProperty(req, "route", {
    configurable: true,
    enumerable: true,
    get: () => matchedRoute,
    set: (route: { path?: unknown } | undefined) => {
      matchedRoute = route;

      if (typeof route?.path === "string") {
        routePattern = `${req.baseUrl}${route.path}`;
      }
    },
  });

  res.on("finish", () => {
    const labels = {
      method: req.method,
      route: routePattern,
      status: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels);
    stopTimer(labels);
  });

  next();
};

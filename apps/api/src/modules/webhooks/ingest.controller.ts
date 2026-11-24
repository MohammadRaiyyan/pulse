import type { Request, Response } from "express";
import * as webhookService from "./webhook.service.ts";

const flattenHeaders = (headers: Request["headers"]) => {
  const flat: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) {
      flat[name] = Array.isArray(value) ? value.join(", ") : value;
    }
  }

  return flat;
};

export const receive = async (req: Request, res: Response) => {
  await webhookService.receiveWebhookEvent(String(req.params.slug), {
    method: req.method,
    headers: flattenHeaders(req.headers),
    body: typeof req.body === "string" ? req.body : "",
    contentType: req.get("content-type") ?? null,
    sourceIp: req.ip ?? "unknown",
  });

  res.status(202).end();
};

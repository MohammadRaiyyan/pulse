import type { AlertEvent, AlertJobData } from "../../jobs/queues.ts";
import { logger } from "../../lib/logger.ts";
import { safeFetch } from "../../lib/outbound-http.ts";
import {
  type IncidentRecord,
  findIncident,
} from "../incidents/incident.repository.ts";
import { findAlertChannel } from "./alert-channel.repository.ts";

const DELIVERY_TIMEOUT_MS = 10_000;

const buildMessage = (
  event: AlertEvent,
  incident: IncidentRecord | undefined,
) => {
  if (event === "test") {
    return "Test alert from Pulse. This channel is working.";
  }

  if (!incident) {
    return `Pulse alert: ${event}`;
  }

  if (event === "incident.opened") {
    return `[Incident] ${incident.source.name}: ${incident.cause}`;
  }

  return `[Resolved] ${incident.source.name} recovered`;
};

const postJson = async (url: string, body: unknown) => {
  const response = await safeFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "PulseAlerts/1.0",
    },
    body: JSON.stringify(body),
    timeoutMs: DELIVERY_TIMEOUT_MS,
  });

  if (!response.ok) {
    throw new Error(`Alert delivery failed with HTTP ${response.status}`);
  }
};

export const deliverAlert = async (data: AlertJobData) => {
  const channel = await findAlertChannel(data.channelId);

  if (!channel || !channel.isEnabled) {
    logger.info(
      { channelId: data.channelId },
      "Skipping alert for missing or disabled channel",
    );
    return;
  }

  const incident = data.incidentId
    ? await findIncident(data.incidentId)
    : undefined;
  const message = buildMessage(data.event, incident);

  const { type, target } = channel.destination;

  if (type === "email") {
    logger.info(
      { to: target, subject: "Pulse alert", text: message },
      "Email alert",
    );
    return;
  }

  if (type === "slack") {
    await postJson(target, { text: message });
    return;
  }

  await postJson(target, {
    event: data.event,
    message,
    incident: incident ?? null,
    sentAt: new Date().toISOString(),
  });
};

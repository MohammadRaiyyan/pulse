import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { AlertChannelType, AlertEvent } from "@pulse/contracts";
import { env } from "../../config/env.ts";
import type { AlertJobData } from "../../jobs/queues.ts";
import { alertEmail } from "../../lib/email-templates.ts";
import { logger } from "../../lib/logger.ts";
import { isEmailDeliveryEnabled, sendEmail } from "../../lib/mailer.ts";
import { safeFetch } from "../../lib/outbound-http.ts";
import {
  type IncidentRecord,
  findIncident,
} from "../incidents/incident.repository.ts";
import { findChannelForDelivery } from "./alert-channel.repository.ts";
import { saveDeliveryAttempt } from "./alert-delivery.repository.ts";
import { signatureHeaders } from "./webhook-signature.ts";

export const DELIVERY_TIMEOUT_MS = 10_000;
export const TEST_DELIVERY_TIMEOUT_MS = 5_000;

const MAX_ERROR_LENGTH = 500;

export type DeliveryChannel = {
  id: string;
  type: AlertChannelType;
  target: string;
  signingSecret: string;
};

type Alert = {
  event: AlertEvent;
  incident: IncidentRecord | undefined;
};

type DeliveryAttemptInput = Alert & {
  deliveryId: string;
  channel: DeliveryChannel;
  attempt: number;
  isFinalAttempt: boolean;
  timeoutMs: number;
};

type JobAttempt = {
  attempt: number;
  maxAttempts: number;
};

const buildMessage = ({ event, incident }: Alert) => {
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

const buildSubject = ({ event, incident }: Alert) => {
  if (event === "test") {
    return "Pulse test alert";
  }

  const name = incident?.source.name ?? "a source";

  return event === "incident.opened"
    ? `[Incident] ${name} is failing`
    : `[Resolved] ${name} recovered`;
};

const withTimeout = async <T>(work: Promise<T>, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = delay(timeoutMs, undefined, {
    signal: controller.signal,
  }).then(() => {
    throw new Error(`Timed out after ${timeoutMs / 1000}s`);
  });

  try {
    return await Promise.race([work, timeout]);
  } finally {
    controller.abort();
  }
};

const postJson = async (
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number,
) => {
  const response = await safeFetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "PulseAlerts/1.0",
      ...headers,
    },
    body,
    timeoutMs,
  });

  if (!response.ok) {
    throw new Error(`Receiver answered with HTTP ${response.status}`);
  }
};

const sendAlertEmail = async (
  to: string,
  alert: Alert,
  timeoutMs: number,
) => {
  if (!isEmailDeliveryEnabled) {
    throw new Error("Email delivery is not configured on this server");
  }

  const content = alertEmail({
    subject: buildSubject(alert),
    message: buildMessage(alert),
    detailsUrl: new URL(alert.incident ? "/incidents" : "/", env.APP_URL).href,
  });

  await withTimeout(sendEmail({ to, ...content }), timeoutMs);
};

export const deliverToChannel = async (
  channel: DeliveryChannel,
  alert: Alert,
  timeoutMs: number,
) => {
  if (channel.type === "email") {
    await sendAlertEmail(channel.target, alert, timeoutMs);
    return;
  }

  if (channel.type === "slack") {
    const body = JSON.stringify({ text: buildMessage(alert) });
    await postJson(channel.target, body, {}, timeoutMs);
    return;
  }

  const body = JSON.stringify({
    event: alert.event,
    message: buildMessage(alert),
    incident: alert.incident ?? null,
    sentAt: new Date().toISOString(),
  });

  await postJson(
    channel.target,
    body,
    signatureHeaders(channel.signingSecret, body),
    timeoutMs,
  );
};

export const describeDeliveryError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return String(error).slice(0, MAX_ERROR_LENGTH);
  }

  if (error.name === "TimeoutError") {
    return "Timed out waiting for the receiver";
  }

  const cause = error.cause instanceof Error ? `: ${error.cause.message}` : "";

  return `${error.message}${cause}`.slice(0, MAX_ERROR_LENGTH);
};

export const attemptDelivery = async (input: DeliveryAttemptInput) => {
  const record = {
    id: input.deliveryId,
    channelId: input.channel.id,
    event: input.event,
    incidentId: input.incident?.id ?? null,
    attempts: input.attempt,
  };

  try {
    await deliverToChannel(input.channel, input, input.timeoutMs);
  } catch (error) {
    const delivery = await saveDeliveryAttempt({
      ...record,
      status: input.isFinalAttempt ? "failed" : "retrying",
      lastError: describeDeliveryError(error),
    });
    return { delivery, error };
  }

  const delivery = await saveDeliveryAttempt({
    ...record,
    status: "success",
    lastError: null,
  });

  return { delivery, error: undefined };
};

export const deliverAlert = async (
  data: AlertJobData,
  { attempt, maxAttempts }: JobAttempt = { attempt: 1, maxAttempts: 1 },
) => {
  const channel = await findChannelForDelivery(data.channelId);

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

  const { error } = await attemptDelivery({
    deliveryId: data.deliveryId ?? randomUUID(),
    channel,
    event: data.event,
    incident,
    attempt,
    isFinalAttempt: attempt >= maxAttempts,
    timeoutMs: DELIVERY_TIMEOUT_MS,
  });

  if (error) {
    throw error;
  }
};

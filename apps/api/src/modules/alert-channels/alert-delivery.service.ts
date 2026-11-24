import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { Response } from "undici";
import type { AlertJobData } from "../../jobs/queues.ts";
import { alertEmail } from "../../lib/email-templates.ts";
import { logger } from "../../lib/logger.ts";
import { isEmailDeliveryEnabled, sendEmail } from "../../lib/mailer.ts";
import { type SafeFetch, safeFetch } from "../../lib/outbound-http.ts";
import { findIncident } from "../incidents/incident.repository.ts";
import { findChannelForDelivery } from "./alert-channel.repository.ts";
import { saveDeliveryAttempt } from "./alert-delivery.repository.ts";
import {
  type Alert,
  type AlertRequest,
  type DeliveryChannel,
  alertLink,
  buildAlertRequests,
  buildMessage,
  buildSubject,
} from "./alert-payloads.ts";

export const DELIVERY_TIMEOUT_MS = 10_000;
export const TEST_DELIVERY_TIMEOUT_MS = 5_000;

const MAX_ERROR_LENGTH = 500;

type DeliveryAttemptInput = Alert & {
  channel: DeliveryChannel;
  attempt: number;
  isFinalAttempt: boolean;
  timeoutMs: number;
};

type JobAttempt = {
  attempt: number;
  maxAttempts: number;
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

const receiverErrorMessage = async (response: Response) => {
  const text = await response.text().catch(() => "");

  try {
    const parsed: unknown = JSON.parse(text);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof parsed.message === "string"
    ) {
      return `: ${parsed.message}`;
    }
  } catch {
    return "";
  }

  return "";
};

const postJson = async (
  fetcher: SafeFetch,
  request: AlertRequest,
  timeoutMs: number,
) => {
  const response = await fetcher(request.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "PulseAlerts/1.0",
      ...request.headers,
    },
    body: request.body,
    timeoutMs,
  });

  if (!response.ok) {
    const detail = await receiverErrorMessage(response);
    throw new Error(`Receiver answered with HTTP ${response.status}${detail}`);
  }

  await response.body?.cancel();
};

const sendAlertEmail = async (to: string, alert: Alert, timeoutMs: number) => {
  if (!isEmailDeliveryEnabled) {
    throw new Error("Email delivery is not configured on this server");
  }

  const content = alertEmail({
    subject: buildSubject(alert),
    message: buildMessage(alert),
    detailsUrl: alertLink(alert),
  });

  await withTimeout(sendEmail({ to, ...content }), timeoutMs);
};

export const deliverToChannel = async (
  channel: DeliveryChannel,
  alert: Alert,
  timeoutMs: number,
  fetcher: SafeFetch = safeFetch,
) => {
  if (channel.type === "email") {
    await sendAlertEmail(channel.target, alert, timeoutMs);
    return;
  }

  const deadline = Date.now() + timeoutMs;

  for (const request of buildAlertRequests(channel, alert)) {
    await postJson(fetcher, request, Math.max(deadline - Date.now(), 1));
  }
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

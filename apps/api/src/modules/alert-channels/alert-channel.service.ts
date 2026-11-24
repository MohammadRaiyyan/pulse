import { randomUUID } from "node:crypto";
import type {
  CreateAlertChannelInput,
  PaginationQuery,
  UpdateAlertChannelInput,
} from "@pulse/contracts";
import { conflict, notFound } from "../../lib/errors.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import { publishChange } from "../../lib/realtime.ts";
import {
  deleteAlertChannel,
  findAlertChannel,
  findChannelForDelivery,
  findSigningSecret,
  insertAlertChannel,
  listAlertChannels,
  updateAlertChannel,
  updateSigningSecret,
} from "./alert-channel.repository.ts";
import { listDeliveriesForChannel } from "./alert-delivery.repository.ts";
import {
  TEST_DELIVERY_TIMEOUT_MS,
  attemptDelivery,
} from "./alert-delivery.service.ts";
import { generateSigningSecret } from "./webhook-signature.ts";

const LABEL = "Alert channel";

export const getAlertChannels = async (query: PaginationQuery) => {
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listAlertChannels(limit, offset);
  return toPage(rows, total, query);
};

export const getAlertChannel = async (id: string) => {
  const channel = await findAlertChannel(id);

  if (!channel) {
    throw notFound(LABEL);
  }

  return channel;
};

export const createAlertChannel = async (input: CreateAlertChannelInput) => {
  const channel = await insertAlertChannel({
    name: input.name,
    isEnabled: input.isEnabled,
    type: input.destination.type,
    target: input.destination.target,
  });
  publishChange({ type: "alertChannel.updated", id: channel.id });

  return channel;
};

export const updateAlertChannelById = async (
  id: string,
  input: UpdateAlertChannelInput,
) => {
  const channel = await updateAlertChannel(id, {
    name: input.name,
    isEnabled: input.isEnabled,
    type: input.destination?.type,
    target: input.destination?.target,
  });

  if (!channel) {
    throw notFound(LABEL);
  }

  publishChange({ type: "alertChannel.updated", id });

  return channel;
};

export const removeAlertChannel = async (id: string) => {
  const channel = await deleteAlertChannel(id);

  if (!channel) {
    throw notFound(LABEL);
  }

  publishChange({ type: "alertChannel.deleted", id });
};

export const sendTestAlert = async (id: string) => {
  const channel = await findChannelForDelivery(id);

  if (!channel) {
    throw notFound(LABEL);
  }

  if (!channel.isEnabled) {
    throw conflict("Enable the channel before sending a test alert");
  }

  const { delivery } = await attemptDelivery({
    deliveryId: randomUUID(),
    channel,
    event: "test",
    incident: undefined,
    attempt: 1,
    isFinalAttempt: true,
    timeoutMs: TEST_DELIVERY_TIMEOUT_MS,
  });

  return delivery;
};

export const getDeliveries = async (id: string, query: PaginationQuery) => {
  await getAlertChannel(id);
  const { limit, offset } = toLimitOffset(query);
  const { rows, total } = await listDeliveriesForChannel(id, limit, offset);
  return toPage(rows, total, query);
};

const missingSigningSecret = async (id: string) => {
  await getAlertChannel(id);
  return conflict("Only webhook channels have a signing secret");
};

export const getSigningSecret = async (id: string) => {
  const secret = await findSigningSecret(id);

  if (!secret) {
    throw await missingSigningSecret(id);
  }

  return secret;
};

export const rotateSigningSecret = async (id: string) => {
  const secret = await updateSigningSecret(id, generateSigningSecret());

  if (!secret) {
    throw await missingSigningSecret(id);
  }

  return secret;
};

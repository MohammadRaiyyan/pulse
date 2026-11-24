import type {
  CreateAlertChannelInput,
  PaginationQuery,
  UpdateAlertChannelInput,
} from "@pulse/contracts";
import { enqueueAlert } from "../../jobs/queues.ts";
import { conflict, notFound } from "../../lib/errors.ts";
import { toLimitOffset, toPage } from "../../lib/pagination.ts";
import {
  deleteAlertChannel,
  findAlertChannel,
  insertAlertChannel,
  listAlertChannels,
  updateAlertChannel,
} from "./alert-channel.repository.ts";

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

export const createAlertChannel = (input: CreateAlertChannelInput) =>
  insertAlertChannel({
    name: input.name,
    isEnabled: input.isEnabled,
    type: input.destination.type,
    target: input.destination.target,
  });

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

  return channel;
};

export const removeAlertChannel = async (id: string) => {
  const channel = await deleteAlertChannel(id);

  if (!channel) {
    throw notFound(LABEL);
  }
};

export const sendTestAlert = async (id: string) => {
  const channel = await getAlertChannel(id);

  if (!channel.isEnabled) {
    throw conflict("Enable the channel before sending a test alert");
  }

  await enqueueAlert({ channelId: channel.id, event: "test" });
};

import {
  type AlertChannel,
  type CreateAlertChannelInput,
  type UpdateAlertChannelInput,
  endpoints,
  resources,
} from "@pulse/contracts";
import { db } from "../db";
import { findById } from "../lib/collection";
import { crudHandlers } from "../lib/crud";
import { newId } from "../lib/ids";
import { detachAlertChannel } from "../lib/relations";
import { errorResponse, noContent } from "../lib/responses";
import { route } from "../lib/route";
import { now } from "../lib/time";

const LABEL = "Alert channel";

const toChannel = (input: CreateAlertChannelInput): AlertChannel => ({
  ...input,
  id: newId(),
  createdAt: now(),
});

const applyChannelUpdate = (
  channel: AlertChannel,
  input: UpdateAlertChannelInput,
): AlertChannel => ({ ...channel, ...input });

const testAlertChannel = route(endpoints.testAlertChannel, ({ params }) => {
  const channel = findById(db.alertChannels, params, LABEL);

  if (!channel.isEnabled) {
    return errorResponse(
      "CONFLICT",
      "Enable the channel before sending a test alert",
    );
  }

  return noContent();
});

export const alertChannelHandlers = [
  ...crudHandlers(resources.alertChannels, {
    label: LABEL,
    store: db.alertChannels,
    sortKey: (channel) => channel.createdAt,
    toItem: toChannel,
    applyUpdate: applyChannelUpdate,
    onDelete: (channel) => detachAlertChannel(channel.id),
  }),
  testAlertChannel,
];

import {
  type AlertChannel,
  type AlertChannelType,
  type AlertDelivery,
  type AlertDestination,
  type AlertDestinationUpdate,
  type CreateAlertChannelInput,
  type UpdateAlertChannelInput,
  endpoints,
  isMaskedSecret,
  isSecretAlertChannelType,
  maskSecret,
  resources,
} from "@pulse/contracts";
import type { PathParams } from "msw";
import { db } from "../db";
import { childListHandler } from "../lib/child-list";
import { findById } from "../lib/collection";
import { crudHandlers } from "../lib/crud";
import { newId } from "../lib/ids";
import { detachAlertChannel } from "../lib/relations";
import { errorResponse } from "../lib/responses";
import { route } from "../lib/route";
import { now } from "../lib/time";

const LABEL = "Alert channel";

const toDestination = (
  destination: AlertDestination | AlertDestinationUpdate,
  current: AlertChannel["destination"] | undefined,
): AlertChannel["destination"] => {
  const isMasked = isSecretAlertChannelType(destination.type);
  const region = destination.type === "opsgenie" ? destination.region : null;
  const keepsTarget =
    destination.target === undefined || isMaskedSecret(destination.target);

  if (keepsTarget && current) {
    return { ...current, type: destination.type, region };
  }

  const target = destination.target ?? "";

  return {
    type: destination.type,
    target: isMasked ? maskSecret(target) : target,
    region,
    isMasked,
  };
};

const toChannel = (input: CreateAlertChannelInput): AlertChannel => ({
  ...input,
  destination: toDestination(input.destination, undefined),
  id: newId(),
  createdAt: now(),
  lastDelivery: null,
});

const newSigningSecret = () =>
  `whsec_${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;

const recordTestDelivery = (channel: AlertChannel): AlertDelivery => {
  const timestamp = now();
  const delivery: AlertDelivery = {
    id: newId(),
    event: "test",
    incidentId: null,
    status: "success",
    attempts: 1,
    lastError: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  db.alertChannels.set(channel.id, { ...channel, lastDelivery: delivery });
  db.alertDeliveries.set(channel.id, [
    ...(db.alertDeliveries.get(channel.id) ?? []),
    delivery,
  ]);

  return delivery;
};

const findWebhookChannel = (params: PathParams) => {
  const channel = findById(db.alertChannels, params, LABEL);

  return channel.destination.type === "webhook" ? channel : undefined;
};

const onlyWebhooks = () =>
  errorResponse("CONFLICT", "Only webhook channels have a signing secret");

const applyChannelUpdate = (
  channel: AlertChannel,
  input: UpdateAlertChannelInput,
): AlertChannel => ({
  ...channel,
  name: input.name ?? channel.name,
  isEnabled: input.isEnabled ?? channel.isEnabled,
  destination: input.destination
    ? toDestination(input.destination, channel.destination)
    : channel.destination,
});

const countAlertChannels = route(
  endpoints.countAlertChannelsByType,
  ({ respond }) => {
    const counts = new Map<AlertChannelType, number>();

    for (const channel of db.alertChannels.values()) {
      const { type } = channel.destination;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }

    return respond([...counts].map(([type, count]) => ({ type, count })));
  },
);

const testAlertChannel = route(
  endpoints.testAlertChannel,
  ({ params, respond }) => {
    const channel = findById(db.alertChannels, params, LABEL);

    if (!channel.isEnabled) {
      return errorResponse(
        "CONFLICT",
        "Enable the channel before sending a test alert",
      );
    }

    return respond(recordTestDelivery(channel));
  },
);

const getSigningSecret = route(
  endpoints.getAlertChannelSigningSecret,
  ({ params, respond }) => {
    const channel = findWebhookChannel(params);

    if (!channel) {
      return onlyWebhooks();
    }

    const signingSecret =
      db.signingSecrets.get(channel.id) ?? newSigningSecret();
    db.signingSecrets.set(channel.id, signingSecret);

    return respond({ signingSecret });
  },
);

const rotateSigningSecret = route(
  endpoints.rotateAlertChannelSigningSecret,
  ({ params, respond }) => {
    const channel = findWebhookChannel(params);

    if (!channel) {
      return onlyWebhooks();
    }

    const signingSecret = newSigningSecret();
    db.signingSecrets.set(channel.id, signingSecret);

    return respond({ signingSecret });
  },
);

export const alertChannelHandlers = [
  countAlertChannels,
  ...crudHandlers(resources.alertChannels, {
    label: LABEL,
    store: db.alertChannels,
    sortKey: (channel) => channel.createdAt,
    toItem: toChannel,
    applyUpdate: applyChannelUpdate,
    onDelete: (channel) => detachAlertChannel(channel.id),
  }),
  testAlertChannel,
  getSigningSecret,
  rotateSigningSecret,
  childListHandler(endpoints.listAlertChannelDeliveries, {
    label: LABEL,
    parents: db.alertChannels,
    children: db.alertDeliveries,
    sortKey: (delivery) => delivery.createdAt,
  }),
];

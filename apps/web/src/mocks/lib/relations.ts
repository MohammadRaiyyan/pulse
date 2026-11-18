import { db } from "../db";
import { errorResponse } from "./responses";

export const assertChannelsExist = (channelIds: readonly string[] = []) => {
  if (!channelIds.every((id) => db.alertChannels.has(id))) {
    throw errorResponse("VALIDATION_ERROR", "Some fields are invalid", {
      fieldErrors: { alertChannelIds: ["Unknown alert channel"] },
    });
  }
};

export const renameIncidentSource = (sourceId: string, name: string) => {
  db.incidents.forEach((incident) => {
    if (incident.source.id === sourceId) {
      db.incidents.set(incident.id, {
        ...incident,
        source: { ...incident.source, name },
      });
    }
  });
};

export const removeIncidentsForSource = (sourceId: string) => {
  db.incidents.forEach((incident) => {
    if (incident.source.id === sourceId) {
      db.incidents.delete(incident.id);
    }
  });
};

const withoutChannel = (channelIds: readonly string[], channelId: string) =>
  channelIds.filter((id) => id !== channelId);

export const detachAlertChannel = (channelId: string) => {
  db.monitors.forEach((monitor) =>
    db.monitors.set(monitor.id, {
      ...monitor,
      alertChannelIds: withoutChannel(monitor.alertChannelIds, channelId),
    }),
  );
  db.webhooks.forEach((webhook) =>
    db.webhooks.set(webhook.id, {
      ...webhook,
      alertChannelIds: withoutChannel(webhook.alertChannelIds, channelId),
    }),
  );
};

type ChannelLinkedSource = {
  id: string;
  name: string;
};

export const channelLinkedSourceHooks = <TItem extends ChannelLinkedSource>(
  onDeleted: (item: TItem) => void,
) => ({
  onUpdate: (item: TItem) => renameIncidentSource(item.id, item.name),
  onDelete: (item: TItem) => {
    onDeleted(item);
    removeIncidentsForSource(item.id);
  },
});

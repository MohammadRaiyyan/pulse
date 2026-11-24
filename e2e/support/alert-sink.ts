import { type ApiClient, uniqueSuffix } from "./api-client.ts";
import { API_ORIGIN } from "./environment.ts";

export const createAlertSink = async (owner: ApiClient) => {
  const sink = await owner.post("/webhooks", {
    name: `Alert sink ${uniqueSuffix()}`,
    expectedIntervalSeconds: null,
    alertChannelIds: [],
  });
  const ingestPath = new URL(sink.body.ingestUrl).pathname;

  const channel = await owner.post("/alert-channels", {
    name: `Sink channel ${uniqueSuffix()}`,
    isEnabled: true,
    destination: { type: "webhook", target: `${API_ORIGIN}${ingestPath}` },
  });

  const receivedAlerts = async () => {
    const events = await owner.get(`/webhooks/${sink.body.id}/events?pageSize=25`);
    return events.body.items.map((event: { body: string }) => JSON.parse(event.body));
  };

  return { webhookId: sink.body.id as string, channelId: channel.body.id as string, receivedAlerts };
};

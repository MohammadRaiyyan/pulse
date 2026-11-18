import type { CreateWebhookInput } from "@pulse/contracts";

export const defaultWebhookInput: CreateWebhookInput = {
  name: "",
  expectedIntervalSeconds: null,
  alertChannelIds: [],
};

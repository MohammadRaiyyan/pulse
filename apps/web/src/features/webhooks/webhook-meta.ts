import type { WebhookStatus } from "@pulse/contracts";
import type { StatusMeta } from "@/components/data/tones";

export const webhookStatusMeta: Record<WebhookStatus, StatusMeta> = {
  active: { label: "Active", tone: "success" },
  silent: { label: "Silent", tone: "danger" },
  pending: { label: "Awaiting first event", tone: "neutral" },
};

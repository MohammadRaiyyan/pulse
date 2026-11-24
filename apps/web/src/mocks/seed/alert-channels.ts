import type { AlertChannel } from "@pulse/contracts";
import { seedId } from "../lib/ids";
import { minutesAgo } from "../lib/time";

const CHANNEL_NAMESPACE = 2;

export const seedAlertChannels = (): AlertChannel[] => [
  {
    id: seedId(CHANNEL_NAMESPACE, 1),
    name: "On-call email",
    isEnabled: true,
    destination: { type: "email", target: "oncall@pulse.dev" },
    createdAt: minutesAgo(20_000),
    lastDelivery: {
      id: seedId(CHANNEL_NAMESPACE, 101),
      event: "incident.opened",
      incidentId: null,
      status: "success",
      attempts: 1,
      lastError: null,
      createdAt: minutesAgo(90),
      updatedAt: minutesAgo(90),
    },
  },
  {
    id: seedId(CHANNEL_NAMESPACE, 2),
    name: "#incidents",
    isEnabled: true,
    destination: {
      type: "slack",
      target: "https://hooks.slack.com/services/T000/B000/XXXX",
    },
    createdAt: minutesAgo(15_000),
    lastDelivery: {
      id: seedId(CHANNEL_NAMESPACE, 102),
      event: "incident.opened",
      incidentId: null,
      status: "failed",
      attempts: 5,
      lastError: "Receiver answered with HTTP 404",
      createdAt: minutesAgo(95),
      updatedAt: minutesAgo(60),
    },
  },
  {
    id: seedId(CHANNEL_NAMESPACE, 3),
    name: "PagerDuty bridge",
    isEnabled: false,
    destination: {
      type: "webhook",
      target: "https://events.example.com/pulse",
    },
    createdAt: minutesAgo(9_000),
    lastDelivery: null,
  },
];

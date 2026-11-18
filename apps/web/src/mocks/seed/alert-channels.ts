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
  },
];

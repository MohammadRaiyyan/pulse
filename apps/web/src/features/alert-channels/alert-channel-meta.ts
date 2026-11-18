import {
  type AlertChannelType,
  alertChannelTypeSchema,
} from "@pulse/contracts";
import {
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  WebhookIcon,
} from "lucide-react";
import type { StatusMeta } from "@/components/data/tones";
import { metaOptions } from "@/lib/options";

type ChannelTypeMeta = StatusMeta & {
  icon: LucideIcon;
  targetLabel: string;
  targetPlaceholder: string;
};

export const channelTypeMeta: Record<AlertChannelType, ChannelTypeMeta> = {
  email: {
    label: "Email",
    tone: "neutral",
    icon: MailIcon,
    targetLabel: "Email address",
    targetPlaceholder: "oncall@company.com",
  },
  slack: {
    label: "Slack",
    tone: "neutral",
    icon: MessageSquareIcon,
    targetLabel: "Incoming webhook URL",
    targetPlaceholder: "https://hooks.slack.com/services/...",
  },
  webhook: {
    label: "Webhook",
    tone: "neutral",
    icon: WebhookIcon,
    targetLabel: "Endpoint URL",
    targetPlaceholder: "https://example.com/alerts",
  },
};

export const channelTypeOptions = metaOptions(
  alertChannelTypeSchema.options,
  channelTypeMeta,
);

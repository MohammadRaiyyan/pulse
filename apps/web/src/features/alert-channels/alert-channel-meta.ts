import {
  type AlertChannelType,
  type AlertDeliveryStatus,
  type OpsgenieRegion,
  alertChannelTypeSchema,
} from "@pulse/contracts";
import {
  HashIcon,
  type LucideIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneCallIcon,
  ShieldAlertIcon,
  UsersRoundIcon,
  WebhookIcon,
} from "lucide-react";
import type { StatusMeta } from "@/components/data/tones";
import { type Option, metaOptions } from "@/lib/options";

type ExpectedHost = {
  pattern: RegExp;
  message: string;
};

type ChannelTypeMeta = StatusMeta & {
  icon: LucideIcon;
  description: string;
  namePlaceholder: string;
  targetLabel: string;
  targetPlaceholder: string;
  setupSteps: readonly string[];
  testNote: string;
  expectedHost?: ExpectedHost;
};

export const channelTypeMeta: Record<AlertChannelType, ChannelTypeMeta> = {
  email: {
    label: "Email",
    tone: "neutral",
    icon: MailIcon,
    description: "Send alerts to an inbox or a distribution list.",
    namePlaceholder: "On-call email",
    targetLabel: "Email address",
    targetPlaceholder: "oncall@company.com",
    setupSteps: [
      "Enter an address that someone watches, such as an on-call distribution list.",
      "Pulse sends alerts through the SMTP server configured for this workspace, so allow its sender address in your spam filters.",
    ],
    testNote: "A test alert sends a short email to this address.",
  },
  slack: {
    label: "Slack",
    tone: "neutral",
    icon: HashIcon,
    description: "Post alerts to a channel through an incoming webhook.",
    namePlaceholder: "#incidents",
    targetLabel: "Incoming webhook URL",
    targetPlaceholder: "https://hooks.slack.com/services/...",
    setupSteps: [
      "Go to api.slack.com/apps and create an app from scratch in your workspace.",
      "Open Incoming Webhooks, turn on Activate Incoming Webhooks, then select Add New Webhook and pick the channel for alerts.",
      "Copy the webhook URL and paste it below.",
    ],
    testNote: "A test alert posts a short message to the channel.",
    expectedHost: {
      pattern: /^hooks\.slack\.com$/,
      message:
        "Slack incoming webhook URLs usually start with https://hooks.slack.com/.",
    },
  },
  teams: {
    label: "Microsoft Teams",
    tone: "neutral",
    icon: UsersRoundIcon,
    description:
      "Post Adaptive Card alerts to a channel through a Workflows webhook.",
    namePlaceholder: "Ops channel",
    targetLabel: "Workflow URL",
    targetPlaceholder: "https://...logic.azure.com/workflows/...",
    setupSteps: [
      "In Teams, open the channel's More options menu and select Workflows.",
      "Choose the template Post to a channel when a webhook request is received, then confirm the team and channel.",
      "Copy the URL the workflow shows when it is created and paste it below.",
    ],
    testNote: "A test alert posts a card to the channel.",
    expectedHost: {
      pattern:
        /(^|\.)(logic\.azure\.com|powerplatform\.com|webhook\.office\.com)$/,
      message:
        "Teams workflow URLs are usually on logic.azure.com or powerplatform.com.",
    },
  },
  discord: {
    label: "Discord",
    tone: "neutral",
    icon: MessageCircleIcon,
    description: "Post color-coded alerts to a channel through a webhook.",
    namePlaceholder: "#alerts",
    targetLabel: "Webhook URL",
    targetPlaceholder: "https://discord.com/api/webhooks/...",
    setupSteps: [
      "In Discord, open Server Settings, then Integrations, then Webhooks.",
      "Select New Webhook and choose the channel for alerts.",
      "Select Copy Webhook URL and paste it below.",
    ],
    testNote: "A test alert posts a gray embed to the channel.",
    expectedHost: {
      pattern: /^([a-z]+\.)?discord(app)?\.com$/,
      message:
        "Discord webhook URLs usually start with https://discord.com/api/webhooks/.",
    },
  },
  pagerduty: {
    label: "PagerDuty",
    tone: "neutral",
    icon: PhoneCallIcon,
    description:
      "Trigger and resolve PagerDuty incidents through the Events API v2.",
    namePlaceholder: "Primary on-call",
    targetLabel: "Integration key",
    targetPlaceholder: "32-character routing key",
    setupSteps: [
      "In PagerDuty, open Services, then Service Directory, and select the service to page.",
      "On the Integrations tab, select Add an integration and choose Events API V2.",
      "Copy the Integration Key and paste it below.",
    ],
    testNote:
      "A test alert triggers an info-severity event and resolves it right away.",
  },
  opsgenie: {
    label: "Opsgenie",
    tone: "neutral",
    icon: ShieldAlertIcon,
    description: "Create and close Opsgenie alerts for your on-call team.",
    namePlaceholder: "Platform team",
    targetLabel: "API key",
    targetPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    setupSteps: [
      "In Opsgenie, open your team, select Integrations, then Add integration.",
      "Choose API, keep Create and Update Access enabled, and save the integration.",
      "Copy the API key and paste it below. Choose EU if your account is on app.eu.opsgenie.com.",
    ],
    testNote: "A test alert creates a P5 alert in Opsgenie that you can close.",
  },
  webhook: {
    label: "Webhook",
    tone: "neutral",
    icon: WebhookIcon,
    description: "Send signed JSON payloads to your own endpoint.",
    namePlaceholder: "Incident bridge",
    targetLabel: "Endpoint URL",
    targetPlaceholder: "https://example.com/alerts",
    setupSteps: [
      "Enter an endpoint that accepts POST requests with a JSON body.",
      "Every request carries X-Pulse-Timestamp and X-Pulse-Signature headers. After connecting, open the signing secret from the channel's actions to verify them.",
    ],
    testNote: "A test alert sends a signed request with the event test.",
  },
};

export const channelTypeOptions = metaOptions(
  alertChannelTypeSchema.options,
  channelTypeMeta,
);

export const opsgenieRegionOptions: Option<OpsgenieRegion>[] = [
  { value: "us", label: "US (api.opsgenie.com)" },
  { value: "eu", label: "EU (api.eu.opsgenie.com)" },
];

export const opsgenieRegionLabels: Record<OpsgenieRegion, string> = {
  us: "US",
  eu: "EU",
};

export const unexpectedHostMessage = (
  type: AlertChannelType,
  target: string,
) => {
  const expected = channelTypeMeta[type].expectedHost;

  if (!expected || !URL.canParse(target)) {
    return undefined;
  }

  return expected.pattern.test(new URL(target).hostname)
    ? undefined
    : expected.message;
};

export const deliveryStatusMeta: Record<AlertDeliveryStatus, StatusMeta> = {
  success: { label: "Delivered", tone: "success" },
  retrying: { label: "Retrying", tone: "warning" },
  failed: { label: "Failed", tone: "danger" },
};

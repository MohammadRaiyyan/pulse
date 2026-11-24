import type {
  AlertChannelType,
  AlertEvent,
  IncidentSeverity,
  OpsgenieRegion,
} from "@pulse/contracts";
import { env } from "../../config/env.ts";
import type { IncidentRecord } from "../incidents/incident.repository.ts";
import { signatureHeaders } from "./webhook-signature.ts";

export type Alert = {
  event: AlertEvent;
  incident: IncidentRecord | undefined;
  deliveryId: string;
};

export type DeliveryChannel = {
  id: string;
  type: AlertChannelType;
  target: string;
  region: OpsgenieRegion | null;
  signingSecret: string;
};

export type AlertRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

export const PAGERDUTY_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue";

export const OPSGENIE_API_HOSTS: Record<OpsgenieRegion, string> = {
  us: "https://api.opsgenie.com",
  eu: "https://api.eu.opsgenie.com",
};

export const DISCORD_COLORS: Record<AlertEvent, number> = {
  "incident.opened": 0xdc2626,
  "incident.resolved": 0x16a34a,
  test: 0x64748b,
};

const PAGERDUTY_SEVERITY: Record<IncidentSeverity, string> = {
  critical: "critical",
  warning: "warning",
};

const OPSGENIE_PRIORITY: Record<IncidentSeverity, string> = {
  critical: "P1",
  warning: "P3",
};

const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
};

const SOURCE_LABELS: Record<IncidentRecord["source"]["type"], string> = {
  monitor: "Monitor",
  webhook: "Webhook",
};

const truncate = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

export const buildMessage = ({ event, incident }: Alert) => {
  if (event === "test") {
    return "Test alert from Pulse. This channel is working.";
  }

  if (!incident) {
    return `Pulse alert: ${event}`;
  }

  if (event === "incident.opened") {
    return `[Incident] ${incident.source.name}: ${incident.cause}`;
  }

  return `[Resolved] ${incident.source.name} recovered`;
};

export const buildSubject = ({ event, incident }: Alert) => {
  if (event === "test") {
    return "Pulse test alert";
  }

  const name = incident?.source.name ?? "a source";

  return event === "incident.opened"
    ? `[Incident] ${name} is failing`
    : `[Resolved] ${name} recovered`;
};

export const alertLink = ({ incident }: Alert) =>
  new URL(incident ? "/incidents" : "/", env.APP_URL).href;

const sourceLabel = (incident: IncidentRecord) =>
  `${incident.source.name} (${SOURCE_LABELS[incident.source.type].toLowerCase()})`;

const incidentFacts = (incident: IncidentRecord) => [
  { title: "Severity", value: SEVERITY_LABELS[incident.severity] },
  { title: "Cause", value: incident.cause },
  { title: "Source", value: sourceLabel(incident) },
];

const requireIncident = ({ event, incident }: Alert) => {
  if (!incident) {
    throw new Error(`The incident for this ${event} alert no longer exists`);
  }

  return incident;
};

const json = (url: string, payload: unknown, headers = {}): AlertRequest => ({
  url,
  headers,
  body: JSON.stringify(payload),
});

export const buildSlackPayload = (alert: Alert) => ({
  text: buildMessage(alert),
});

const teamsTitleColor = (event: AlertEvent) => {
  if (event === "incident.opened") {
    return "Attention";
  }

  return event === "incident.resolved" ? "Good" : "Default";
};

export const buildTeamsPayload = (alert: Alert) => {
  const facts = alert.incident ? incidentFacts(alert.incident) : [];

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          msteams: { width: "Full" },
          body: [
            {
              type: "TextBlock",
              text: buildSubject(alert),
              size: "Large",
              weight: "Bolder",
              color: teamsTitleColor(alert.event),
              wrap: true,
            },
            { type: "TextBlock", text: buildMessage(alert), wrap: true },
            ...(facts.length > 0 ? [{ type: "FactSet", facts }] : []),
          ],
          actions: [
            {
              type: "Action.OpenUrl",
              title: alert.incident ? "View incident" : "Open Pulse",
              url: alertLink(alert),
            },
          ],
        },
      },
    ],
  };
};

export const buildDiscordPayload = (alert: Alert) => {
  const fields = alert.incident
    ? incidentFacts(alert.incident).map(({ title, value }) => ({
        name: title,
        value: truncate(value, 1024),
        inline: title !== "Cause",
      }))
    : [];

  return {
    username: "Pulse",
    content: truncate(buildMessage(alert), 2000),
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: truncate(buildSubject(alert), 256),
        url: alertLink(alert),
        color: DISCORD_COLORS[alert.event],
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };
};

export const pagerDutyTestKey = (alert: Alert) =>
  `pulse-test-${alert.deliveryId}`;

export const buildPagerDutyEvents = (routingKey: string, alert: Alert) => {
  const link = alertLink(alert);

  if (alert.event === "test") {
    const dedupKey = pagerDutyTestKey(alert);

    return [
      {
        routing_key: routingKey,
        event_action: "trigger",
        dedup_key: dedupKey,
        client: "Pulse",
        client_url: link,
        payload: {
          summary: "Pulse test alert. This integration is working.",
          source: "Pulse",
          severity: "info",
          timestamp: new Date().toISOString(),
        },
      },
      { routing_key: routingKey, event_action: "resolve", dedup_key: dedupKey },
    ];
  }

  const incident = requireIncident(alert);

  if (alert.event === "incident.resolved") {
    return [
      {
        routing_key: routingKey,
        event_action: "resolve",
        dedup_key: incident.id,
      },
    ];
  }

  return [
    {
      routing_key: routingKey,
      event_action: "trigger",
      dedup_key: incident.id,
      client: "Pulse",
      client_url: link,
      links: [{ href: link, text: "View incident in Pulse" }],
      payload: {
        summary: truncate(`${incident.source.name}: ${incident.cause}`, 1024),
        source: incident.source.name,
        severity: PAGERDUTY_SEVERITY[incident.severity],
        timestamp: incident.startedAt.toISOString(),
        component: incident.source.name,
        class: incident.source.type,
        custom_details: {
          cause: incident.cause,
          sourceType: incident.source.type,
          incidentId: incident.id,
        },
      },
    },
  ];
};

export const opsgenieTestAlias = (alert: Alert) =>
  `pulse-test-${alert.deliveryId}`;

export const buildOpsgenieRequests = (
  apiKey: string,
  region: OpsgenieRegion,
  alert: Alert,
) => {
  const host = OPSGENIE_API_HOSTS[region];
  const headers = { Authorization: `GenieKey ${apiKey}` };
  const link = alertLink(alert);

  if (alert.event === "test") {
    return [
      json(
        `${host}/v2/alerts`,
        {
          message: "Pulse test alert",
          alias: opsgenieTestAlias(alert),
          description:
            "Test alert from Pulse. This integration is working. You can close this alert.",
          priority: "P5",
          source: "Pulse",
          tags: ["pulse", "test"],
          details: { link },
        },
        headers,
      ),
    ];
  }

  const incident = requireIncident(alert);

  if (alert.event === "incident.resolved") {
    return [
      json(
        `${host}/v2/alerts/${encodeURIComponent(incident.id)}/close?identifierType=alias`,
        { source: "Pulse", note: `${incident.source.name} recovered` },
        headers,
      ),
    ];
  }

  return [
    json(
      `${host}/v2/alerts`,
      {
        message: truncate(`${incident.source.name}: ${incident.cause}`, 130),
        alias: incident.id,
        description: truncate(`${incident.cause}\n\n${link}`, 15_000),
        priority: OPSGENIE_PRIORITY[incident.severity],
        source: "Pulse",
        entity: truncate(incident.source.name, 512),
        tags: ["pulse", incident.source.type, incident.severity],
        details: {
          cause: incident.cause,
          sourceType: incident.source.type,
          severity: incident.severity,
          startedAt: incident.startedAt.toISOString(),
          link,
        },
      },
      headers,
    ),
  ];
};

export const buildWebhookRequest = (channel: DeliveryChannel, alert: Alert) => {
  const body = JSON.stringify({
    event: alert.event,
    message: buildMessage(alert),
    incident: alert.incident ?? null,
    sentAt: new Date().toISOString(),
  });

  return {
    url: channel.target,
    headers: signatureHeaders(channel.signingSecret, body),
    body,
  };
};

export const buildAlertRequests = (
  channel: DeliveryChannel,
  alert: Alert,
): AlertRequest[] => {
  switch (channel.type) {
    case "slack":
      return [json(channel.target, buildSlackPayload(alert))];
    case "teams":
      return [json(channel.target, buildTeamsPayload(alert))];
    case "discord":
      return [json(channel.target, buildDiscordPayload(alert))];
    case "pagerduty":
      return buildPagerDutyEvents(channel.target, alert).map((event) =>
        json(PAGERDUTY_EVENTS_URL, event),
      );
    case "opsgenie":
      return buildOpsgenieRequests(
        channel.target,
        channel.region ?? "us",
        alert,
      );
    case "webhook":
      return [buildWebhookRequest(channel, alert)];
    case "email":
      throw new Error("Email alerts are not sent over HTTP");
  }
};

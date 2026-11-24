import type {
  AlertChannel,
  CheckResult,
  Incident,
  Invitation,
  LinkedAccount,
  Monitor,
  User,
  Webhook,
  WebhookEvent,
} from "@pulse/contracts";
import type { Identifiable } from "./lib/collection";
import { seedAlertChannels } from "./seed/alert-channels";
import { seedIncidents } from "./seed/incidents";
import { seedInvitations } from "./seed/invitations";
import { seedLinkedAccounts } from "./seed/linked-accounts";
import { seedMonitors } from "./seed/monitors";
import { seedPasswords, seedUsers } from "./seed/users";
import { seedWebhooks } from "./seed/webhooks";

type MockDb = {
  users: Map<string, User>;
  passwords: Map<string, string>;
  linkedAccounts: Map<string, LinkedAccount[]>;
  alertChannels: Map<string, AlertChannel>;
  monitors: Map<string, Monitor>;
  checks: Map<string, CheckResult[]>;
  webhooks: Map<string, Webhook>;
  webhookEvents: Map<string, WebhookEvent[]>;
  incidents: Map<string, Incident>;
  invitations: Map<string, Invitation>;
};

const byId = <TItem extends Identifiable>(items: readonly TItem[]) =>
  new Map(items.map((item) => [item.id, item]));

const createDb = (): MockDb => {
  const users = seedUsers();
  const [owner] = users;
  const alertChannels = seedAlertChannels();
  const channelIds = alertChannels.map((channel) => channel.id);
  const monitorSeeds = seedMonitors(channelIds);
  const monitors = monitorSeeds.map((seed) => seed.monitor);
  const { webhooks, events } = seedWebhooks(channelIds);

  return {
    users: byId(users),
    passwords: seedPasswords(users),
    linkedAccounts: seedLinkedAccounts(owner),
    alertChannels: byId(alertChannels),
    monitors: byId(monitors),
    checks: new Map(monitorSeeds.map((seed) => [seed.monitor.id, seed.checks])),
    webhooks: byId(webhooks),
    webhookEvents: events,
    incidents: byId(seedIncidents(users, monitors, webhooks)),
    invitations: byId(seedInvitations(owner)),
  };
};

export const db: MockDb = createDb();

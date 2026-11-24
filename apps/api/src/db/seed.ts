import type {
  CheckOutcome,
  HttpMethod,
  MonitorStatus,
  RequestContentType,
  Role,
} from "@pulse/contracts";
import { sql as rawSql } from "drizzle-orm";
import { isLocalEnvironment } from "../config/env.ts";
import { daysFromNow, minutesFromNow } from "../lib/dates.ts";
import { logger } from "../lib/logger.ts";
import { redis } from "../lib/redis.ts";
import {
  alertChannels,
  checkResults,
  monitorDailyStats,
  incidents,
  invitations,
  monitorAlertChannels,
  monitors,
  type StoredHeader,
  users,
  webhookAlertChannels,
  webhookEvents,
  webhooks,
} from "../models/index.ts";
import { inviteUrlFor } from "../modules/invitations/invitation.service.ts";
import { hashPassword } from "../security/passwords.ts";
import { rebuildDailyStats } from "../modules/monitors/monitor.repository.ts";
import { db, sql } from "./client.ts";

if (!isLocalEnvironment) {
  logger.error("Refusing to seed outside development or test");
  process.exit(1);
}

const HISTORY_DAYS = 90;
const DEMO_PASSWORD = "password123";
const CHECKS_PER_MONITOR = 120;
const STRIPE_EVENT_COUNT = 24;

const minutesAgo = (minutes: number) => minutesFromNow(-minutes);

type MonitorSeed = {
  name: string;
  url: string;
  method: HttpMethod;
  intervalSeconds: number;
  timeoutMs: number;
  status: MonitorStatus;
  isPaused: boolean;
  baseResponseMs: number;
  outcomeAt: (index: number) => CheckOutcome;
  channelIndexes: number[];
  requestHeaders?: StoredHeader[];
  requestBody?: string;
  requestContentType?: RequestContentType;
};

const SOAP_PING_BODY = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Ping xmlns="https://legacy.pulse.invalid/" />
  </soap:Body>
</soap:Envelope>`;

const demoUsers: { name: string; email: string; role: Role }[] = [
  { name: "Olivia Owner", email: "owner@pulse.dev", role: "owner" },
  { name: "Adam Admin", email: "admin@pulse.dev", role: "admin" },
  { name: "Maya Member", email: "member@pulse.dev", role: "member" },
  { name: "Victor Viewer", email: "viewer@pulse.dev", role: "viewer" },
];

const monitorSeeds: MonitorSeed[] = [
  {
    name: "Public API",
    url: "https://jsonplaceholder.typicode.com/posts/1",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 5_000,
    status: "up",
    isPaused: false,
    baseResponseMs: 120,
    outcomeAt: (index) => (index === 40 ? "down" : "up"),
    channelIndexes: [0, 1],
    requestHeaders: [{ name: "Accept", value: "application/json", secret: false }],
  },
  {
    name: "Payments service",
    url: "https://www.cloudflare.com/cdn-cgi/trace",
    method: "GET",
    intervalSeconds: 30,
    timeoutMs: 3_000,
    status: "degraded",
    isPaused: false,
    baseResponseMs: 850,
    outcomeAt: (index) => (index < 10 ? "degraded" : "up"),
    channelIndexes: [0],
  },
  {
    name: "Legacy SOAP gateway",
    url: "https://legacy.pulse.invalid/soap",
    method: "POST",
    intervalSeconds: 300,
    timeoutMs: 10_000,
    status: "down",
    isPaused: false,
    baseResponseMs: 2_400,
    outcomeAt: (index) => (index < 6 ? "down" : "up"),
    channelIndexes: [1],
    requestHeaders: [{ name: "SOAPAction", value: "Ping", secret: false }],
    requestBody: SOAP_PING_BODY,
    requestContentType: "text/xml",
  },
  {
    name: "Docs site",
    url: "https://example.com",
    method: "HEAD",
    intervalSeconds: 600,
    timeoutMs: 5_000,
    status: "up",
    isPaused: true,
    baseResponseMs: 60,
    outcomeAt: () => "up",
    channelIndexes: [],
  },
];

const errorMessageFor: Record<CheckOutcome, string | null> = {
  up: null,
  degraded: "Response slower than threshold",
  down: "Connection timed out",
};

const responseTimeAt = (baseMs: number, index: number) =>
  Math.round(baseMs + baseMs * 0.25 * Math.sin(index / 4) + (index % 7) * 4);

const isoDaysAgo = (days: number) => daysFromNow(-days).toISOString().slice(0, 10);

const seedDailyHistory = async (monitorIds: string[]) => {
  const rows = monitorSeeds.flatMap((seed, monitorIndex) => {
    const monitorId = monitorIds[monitorIndex];

    if (!monitorId) {
      return [];
    }

    return Array.from({ length: HISTORY_DAYS - 1 }, (_, index) => {
      const daysBack = index + 1;
      const checkCount = Math.round(86_400 / seed.intervalSeconds);
      const hasOutage = (daysBack * (monitorIndex + 3)) % 29 === 0;
      const isSlow = (daysBack + monitorIndex * 5) % 13 === 0;

      return {
        monitorId,
        day: isoDaysAgo(daysBack),
        checkCount,
        downCount: hasOutage ? Math.max(1, Math.round(checkCount * 0.03)) : 0,
        degradedCount: isSlow ? Math.round(checkCount * 0.08) : 0,
        totalResponseTimeMs: checkCount * seed.baseResponseMs,
      };
    });
  });

  await db.insert(monitorDailyStats).values(rows).onConflictDoNothing();
};

const clearDatabase = async () => {
  await db.execute(
    rawSql`truncate table users, alert_channels, monitors, webhooks, incidents, invitations restart identity cascade`,
  );
  for (const pattern of ["cache:*", "rate:*"]) {
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
};

const seedUsers = async () => {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  return db
    .insert(users)
    .values(
      demoUsers.map((user, index) => ({
        ...user,
        passwordHash,
        emailVerifiedAt: daysFromNow(-(demoUsers.length - index) * 30),
        createdAt: daysFromNow(-(demoUsers.length - index) * 30),
      })),
    )
    .returning();
};

const seedAlertChannels = () =>
  db
    .insert(alertChannels)
    .values([
      {
        name: "On-call email",
        isEnabled: true,
        type: "email",
        target: "oncall@pulse.dev",
        createdAt: minutesAgo(20_000),
      },
      {
        name: "#incidents",
        isEnabled: true,
        type: "slack",
        target: "https://hooks.slack.com/services/T000/B000/XXXX",
        createdAt: minutesAgo(15_000),
      },
      {
        name: "PagerDuty bridge",
        isEnabled: false,
        type: "webhook",
        target: "https://events.example.com/pulse",
        createdAt: minutesAgo(9_000),
      },
    ])
    .returning();

const seedMonitor = async (seed: MonitorSeed, channelIds: string[]) => {
  const checks = Array.from({ length: CHECKS_PER_MONITOR }, (_, index) => {
    const outcome = seed.outcomeAt(index);

    return {
      outcome,
      statusCode: outcome === "down" ? null : 200,
      responseTimeMs: responseTimeAt(seed.baseResponseMs, index),
      errorMessage: errorMessageFor[outcome],
      checkedAt: minutesAgo((index * seed.intervalSeconds) / 60),
    };
  });

  const latest = checks[0];
  const firstHealthyIndex = checks.findIndex((check) => check.outcome === "up");
  const healthyChecks = checks.filter(
    (check) => check.outcome !== "down",
  ).length;

  const [monitor] = await db
    .insert(monitors)
    .values({
      name: seed.name,
      url: seed.url,
      method: seed.method,
      intervalSeconds: seed.intervalSeconds,
      timeoutMs: seed.timeoutMs,
      expectedStatusCode: 200,
      requestHeaders: seed.requestHeaders ?? [],
      requestBody: seed.requestBody ?? null,
      requestContentType: seed.requestContentType ?? null,
      isPaused: seed.isPaused,
      consecutiveFailures: seed.isPaused
        ? 0
        : firstHealthyIndex === -1
          ? checks.length
          : firstHealthyIndex,
      status: seed.status,
      lastCheckedAt: latest?.checkedAt ?? null,
      lastResponseTimeMs: latest?.responseTimeMs ?? null,
      uptimePercent: (healthyChecks / checks.length) * 100,
      createdAt: minutesAgo(40_000),
      updatedAt: minutesAgo(1_000),
    })
    .returning();

  if (!monitor) {
    throw new Error(`Failed to seed monitor ${seed.name}`);
  }

  await db
    .insert(checkResults)
    .values(checks.map((check) => ({ ...check, monitorId: monitor.id })));

  const linkedChannelIds = seed.channelIndexes
    .map((index) => channelIds[index])
    .filter((id) => id !== undefined);

  if (linkedChannelIds.length > 0) {
    await db
      .insert(monitorAlertChannels)
      .values(
        linkedChannelIds.map((channelId) => ({
          monitorId: monitor.id,
          channelId,
        })),
      );
  }

  return monitor;
};

const seedWebhooks = async (channelIds: string[]) => {
  const stripeEvents = Array.from(
    { length: STRIPE_EVENT_COUNT },
    (_, index) => ({
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": `t=${1_700_000_000 + index},v1=signature${index}`,
        "user-agent": "Stripe/1.0",
      },
      body: JSON.stringify({
        id: `evt_${index.toString().padStart(4, "0")}`,
        type: index % 3 === 0 ? "invoice.paid" : "charge.succeeded",
        data: { object: { amount: 1_000 + index * 250, currency: "usd" } },
      }),
      contentType: "application/json",
      sourceIp: "54.187.174.169",
      receivedAt: minutesAgo(index * 45 + 3),
    }),
  );

  const [stripe, github] = await db
    .insert(webhooks)
    .values([
      {
        name: "Stripe events",
        slug: "stripe-events",
        expectedIntervalSeconds: 3_600,
        status: "active",
        eventCount: stripeEvents.length,
        lastReceivedAt: stripeEvents[0]?.receivedAt ?? null,
        createdAt: minutesAgo(30_000),
      },
      {
        name: "GitHub deploys",
        slug: "github-deploys",
        expectedIntervalSeconds: 86_400,
        status: "silent",
        eventCount: 0,
        lastReceivedAt: null,
        createdAt: minutesAgo(5_000),
      },
    ])
    .returning();

  if (!stripe || !github) {
    throw new Error("Failed to seed webhooks");
  }

  await db
    .insert(webhookEvents)
    .values(stripeEvents.map((event) => ({ ...event, webhookId: stripe.id })));

  const [emailChannel, slackChannel] = channelIds;

  if (emailChannel && slackChannel) {
    await db.insert(webhookAlertChannels).values([
      { webhookId: stripe.id, channelId: emailChannel },
      { webhookId: github.id, channelId: slackChannel },
    ]);
  }

  return { stripe, github };
};

await clearDatabase();

const seededUsers = await seedUsers();
const channels = await seedAlertChannels();
const channelIds = channels.map((channel) => channel.id);

const seededMonitors = [];
for (const seed of monitorSeeds) {
  seededMonitors.push(await seedMonitor(seed, channelIds));
}

await rebuildDailyStats();
await seedDailyHistory(seededMonitors.map((monitor) => monitor.id));

const { github } = await seedWebhooks(channelIds);
const [publicApi, payments, legacy] = seededMonitors;

const [ownerUser, adminUser] = seededUsers;

if (publicApi && payments && legacy && ownerUser && adminUser) {
  await db.insert(incidents).values([
    {
      sourceType: "monitor",
      sourceId: legacy.id,
      sourceName: legacy.name,
      status: "open",
      severity: "critical",
      cause: "Connection timed out after 10000 ms",
      startedAt: minutesAgo(30),
    },
    {
      sourceType: "webhook",
      sourceId: github.id,
      sourceName: github.name,
      status: "open",
      severity: "critical",
      cause: "No events received within 1d",
      startedAt: minutesAgo(180),
    },
    {
      sourceType: "monitor",
      sourceId: payments.id,
      sourceName: payments.name,
      status: "acknowledged",
      severity: "warning",
      cause: "Response time above 800 ms",
      startedAt: minutesAgo(5),
      acknowledgedAt: minutesAgo(2),
      acknowledgedById: adminUser.id,
      acknowledgedByName: adminUser.name,
    },
    {
      sourceType: "monitor",
      sourceId: publicApi.id,
      sourceName: publicApi.name,
      status: "resolved",
      severity: "critical",
      cause: "HTTP 503 Service Unavailable",
      startedAt: minutesAgo(45),
      acknowledgedAt: minutesAgo(43),
      acknowledgedById: ownerUser.id,
      acknowledgedByName: ownerUser.name,
      resolvedAt: minutesAgo(39),
      resolutionReason: "recovered",
    },
    {
      sourceType: "monitor",
      sourceId: crypto.randomUUID(),
      sourceName: "Old status page",
      sourceDeletedAt: minutesAgo(2_000),
      status: "resolved",
      severity: "critical",
      cause: "Expected HTTP 200, got 502",
      startedAt: minutesAgo(2_900),
      acknowledgedAt: minutesAgo(2_880),
      acknowledgedById: adminUser.id,
      acknowledgedByName: adminUser.name,
      resolvedAt: minutesAgo(2_820),
      resolvedById: adminUser.id,
      resolvedByName: adminUser.name,
    },
  ]);
}

const owner = seededUsers[0];

if (owner) {
  const [invitation] = await db
    .insert(invitations)
    .values({
      email: "sam@pulse.dev",
      role: "member",
      invitedBy: owner.id,
      expiresAt: daysFromNow(6),
      createdAt: minutesAgo(1_440),
    })
    .returning();

  if (invitation) {
    logger.info(
      { inviteUrl: inviteUrlFor(invitation.id) },
      "Demo invitation for sam@pulse.dev",
    );
  }
}

logger.info(
  `Seeded ${seededUsers.length} users. Sign in as owner@pulse.dev / ${DEMO_PASSWORD}`,
);

await redis.quit();
await sql.end();
process.exit(0);

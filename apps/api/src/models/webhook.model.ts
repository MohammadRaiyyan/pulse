import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { alertChannels } from "./alert-channel.model.ts";
import { services } from "./service.model.ts";
import { webhookStatusEnum } from "./enums.ts";

export const webhooks = pgTable("webhooks", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  expectedIntervalSeconds: integer(),
  status: webhookStatusEnum().notNull().default("pending"),
  eventCount: integer().notNull().default(0),
  lastReceivedAt: timestamp({ withTimezone: true }),
  serviceId: uuid().references(() => services.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("webhooks_service_idx").on(table.serviceId)]);

export const webhookAlertChannels = pgTable(
  "webhook_alert_channels",
  {
    webhookId: uuid()
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    channelId: uuid()
      .notNull()
      .references(() => alertChannels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.webhookId, table.channelId] })],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    webhookId: uuid()
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    method: text().notNull(),
    headers: jsonb().$type<Record<string, string>>().notNull(),
    body: text().notNull(),
    contentType: text(),
    sourceIp: text().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("webhook_events_webhook_time_idx").on(
      table.webhookId,
      table.receivedAt.desc(),
    ),
  ],
);

export type WebhookRow = typeof webhooks.$inferSelect;
export type WebhookEventRow = typeof webhookEvents.$inferSelect;

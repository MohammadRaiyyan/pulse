import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { alertChannels } from "./alert-channel.model.ts";
import {
  checkOutcomeEnum,
  httpMethodEnum,
  monitorStatusEnum,
} from "./enums.ts";

export const monitors = pgTable(
  "monitors",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    url: text().notNull(),
    method: httpMethodEnum().notNull(),
    intervalSeconds: integer().notNull(),
    timeoutMs: integer().notNull(),
    expectedStatusCode: integer().notNull(),
    isPaused: boolean().notNull().default(false),
    status: monitorStatusEnum().notNull().default("pending"),
    lastCheckedAt: timestamp({ withTimezone: true }),
    lastResponseTimeMs: integer(),
    uptimePercent: real(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("monitors_due_idx").on(table.isPaused, table.lastCheckedAt),
  ],
);

export const monitorAlertChannels = pgTable(
  "monitor_alert_channels",
  {
    monitorId: uuid()
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    channelId: uuid()
      .notNull()
      .references(() => alertChannels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.monitorId, table.channelId] })],
);

export const checkResults = pgTable(
  "check_results",
  {
    id: uuid().primaryKey().defaultRandom(),
    monitorId: uuid()
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    outcome: checkOutcomeEnum().notNull(),
    statusCode: integer(),
    responseTimeMs: integer().notNull(),
    errorMessage: text(),
    checkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("check_results_monitor_time_idx").on(
      table.monitorId,
      table.checkedAt.desc(),
    ),
  ],
);

export type MonitorRow = typeof monitors.$inferSelect;
export type CheckResultRow = typeof checkResults.$inferSelect;

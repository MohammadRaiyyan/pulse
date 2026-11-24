import { DEFAULT_FAILURE_THRESHOLD, MONITOR_LIMITS } from "@pulse/contracts";
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
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
import { services } from "./service.model.ts";
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
    failureThreshold: integer().notNull().default(DEFAULT_FAILURE_THRESHOLD),
    consecutiveFailures: integer().notNull().default(0),
    isPaused: boolean().notNull().default(false),
    status: monitorStatusEnum().notNull().default("pending"),
    lastCheckedAt: timestamp({ withTimezone: true }),
    lastResponseTimeMs: integer(),
    uptimePercent: real(),
    serviceId: uuid().references(() => services.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("monitors_due_idx").on(table.isPaused, table.lastCheckedAt),
    index("monitors_service_idx").on(table.serviceId),
    check(
      "monitors_failure_threshold_range",
      sql`${table.failureThreshold} between ${sql.raw(String(MONITOR_LIMITS.failureThreshold.min))} and ${sql.raw(String(MONITOR_LIMITS.failureThreshold.max))}`,
    ),
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

export const monitorDailyStats = pgTable(
  "monitor_daily_stats",
  {
    monitorId: uuid()
      .notNull()
      .references(() => monitors.id, { onDelete: "cascade" }),
    day: date({ mode: "string" }).notNull(),
    checkCount: integer().notNull().default(0),
    downCount: integer().notNull().default(0),
    degradedCount: integer().notNull().default(0),
    totalResponseTimeMs: bigint({ mode: "number" }).notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.monitorId, table.day] }),
    index("monitor_daily_stats_day_idx").on(table.day),
  ],
);

export type MonitorDailyStatsRow = typeof monitorDailyStats.$inferSelect;

import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  incidentResolutionReasonEnum,
  incidentSeverityEnum,
  incidentSourceTypeEnum,
  incidentStatusEnum,
} from "./enums.ts";

export const incidents = pgTable(
  "incidents",
  {
    id: uuid().primaryKey().defaultRandom(),
    sourceType: incidentSourceTypeEnum().notNull(),
    sourceId: uuid().notNull(),
    sourceName: text().notNull(),
    sourceDeletedAt: timestamp({ withTimezone: true }),
    status: incidentStatusEnum().notNull().default("open"),
    severity: incidentSeverityEnum().notNull().default("critical"),
    cause: text().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    acknowledgedAt: timestamp({ withTimezone: true }),
    acknowledgedById: uuid(),
    acknowledgedByName: text(),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedById: uuid(),
    resolvedByName: text(),
    resolutionReason: incidentResolutionReasonEnum(),
  },
  (table) => [
    index("incidents_status_started_idx").on(
      table.status,
      table.startedAt.desc(),
    ),
    index("incidents_source_idx").on(table.sourceId),
    uniqueIndex("incidents_one_active_per_source")
      .on(table.sourceId)
      .where(sql`${table.status} <> 'resolved'`),
  ],
);

export type IncidentRow = typeof incidents.$inferSelect;

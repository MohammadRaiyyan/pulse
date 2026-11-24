import { sql } from "drizzle-orm";
import { boolean, check, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const STATUS_PAGE_SETTINGS_ID = 1;

export const statusPageSettings = pgTable(
  "status_page_settings",
  {
    id: integer().primaryKey().default(STATUS_PAGE_SETTINGS_ID),
    isEnabled: boolean().notNull().default(false),
    title: text().notNull().default("Status"),
    description: text().notNull().default(""),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check("status_page_settings_singleton", sql`${table.id} = ${sql.raw(String(STATUS_PAGE_SETTINGS_ID))}`)],
);

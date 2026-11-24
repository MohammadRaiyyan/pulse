import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const services = pgTable(
  "services",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    description: text().notNull().default(""),
    isPublic: boolean().notNull().default(false),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("services_name_unique").on(sql`lower(${table.name})`)],
);

export type ServiceRow = typeof services.$inferSelect;

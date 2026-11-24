import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { alertChannelTypeEnum } from "./enums.ts";

export const alertChannels = pgTable("alert_channels", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
  isEnabled: boolean().notNull().default(true),
  type: alertChannelTypeEnum().notNull(),
  target: text().notNull(),
  signingSecret: text()
    .notNull()
    .default(
      sql`('whsec_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))`,
    ),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type AlertChannelRow = typeof alertChannels.$inferSelect;

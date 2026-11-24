import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { alertChannelTypeEnum, opsgenieRegionEnum } from "./enums.ts";

export const alertChannels = pgTable(
  "alert_channels",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    isEnabled: boolean().notNull().default(true),
    type: alertChannelTypeEnum().notNull(),
    target: text().notNull(),
    region: opsgenieRegionEnum(),
    signingSecret: text()
      .notNull()
      .default(
        sql`('whsec_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))`,
      ),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "alert_channels_region_only_for_opsgenie",
      sql`(${table.type}::text = 'opsgenie') = (${table.region} is not null)`,
    ),
  ],
);

export type AlertChannelRow = typeof alertChannels.$inferSelect;

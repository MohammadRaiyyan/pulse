import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { alertChannels } from "./alert-channel.model.ts";
import { alertDeliveryStatusEnum, alertEventEnum } from "./enums.ts";
import { incidents } from "./incident.model.ts";

export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    id: uuid().primaryKey().defaultRandom(),
    channelId: uuid()
      .notNull()
      .references(() => alertChannels.id, { onDelete: "cascade" }),
    event: alertEventEnum().notNull(),
    incidentId: uuid().references(() => incidents.id, {
      onDelete: "set null",
    }),
    status: alertDeliveryStatusEnum().notNull(),
    attempts: integer().notNull().default(1),
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("alert_deliveries_channel_created_idx").on(
      table.channelId,
      table.createdAt.desc(),
    ),
  ],
);

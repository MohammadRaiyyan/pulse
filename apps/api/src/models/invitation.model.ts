import type { AssignableRole } from "@pulse/contracts";
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { invitationStatusEnum, roleEnum } from "./enums.ts";
import { users } from "./user.model.ts";

export const invitations = pgTable(
  "invitations",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    role: roleEnum().$type<AssignableRole>().notNull(),
    status: invitationStatusEnum().notNull().default("pending"),
    invitedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invitations_one_pending_per_email")
      .on(table.email)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export type InvitationRow = typeof invitations.$inferSelect;

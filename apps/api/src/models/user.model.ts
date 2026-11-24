import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { oauthProviderEnum, roleEnum } from "./enums.ts";

export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    email: text().notNull(),
    passwordHash: text(),
    role: roleEnum().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique").on(sql`lower(${table.email})`)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid().notNull(),
    tokenHash: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_family_idx").on(table.familyId),
  ],
);

export const linkedAccounts = pgTable(
  "linked_accounts",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum().notNull(),
    providerAccountId: text().notNull(),
    email: text().notNull(),
    linkedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.provider] }),
    uniqueIndex("linked_accounts_provider_account_unique").on(
      table.provider,
      table.providerAccountId,
    ),
  ],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text().notNull().unique(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  usedAt: timestamp({ withTimezone: true }),
});

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type LinkedAccountRow = typeof linkedAccounts.$inferSelect;

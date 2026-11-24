import { sql as rawSql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { db, sql } from "../db/client.ts";
import { closeQueues } from "../jobs/queues.ts";
import { redis } from "../lib/redis.ts";
import { clearSentEmails } from "./mail.ts";

beforeAll(async () => {
  await migrate(db, {
    migrationsFolder: new URL("../db/migrations", import.meta.url).pathname,
  });
});

beforeEach(async () => {
  await db.execute(
    rawSql`truncate table users, alert_channels, monitors, webhooks, incidents, invitations restart identity cascade`,
  );
  await redis.flushdb();
  await clearSentEmails();
});

afterAll(async () => {
  await closeQueues();
  await redis.quit();
  await sql.end();
});

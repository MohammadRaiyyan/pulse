import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env.ts";
import { logger } from "../lib/logger.ts";
import * as schema from "../models/index.ts";

export const sql = postgres(env.DATABASE_URL, {
  max: 10,
  onnotice: (notice) =>
    logger.debug({ notice: notice.message }, "Postgres notice"),
});

export const db = drizzle({ client: sql, schema, casing: "snake_case" });

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

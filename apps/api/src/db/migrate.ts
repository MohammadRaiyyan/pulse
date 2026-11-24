import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "../config/env.ts";
import { logger } from "../lib/logger.ts";

const sql = postgres(env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL, {
  max: 1,
  onnotice: (notice) =>
    logger.debug({ notice: notice.message }, "Postgres notice"),
});

await migrate(drizzle({ client: sql }), {
  migrationsFolder: new URL("./migrations", import.meta.url).pathname,
});
logger.info("Database migrations applied");
await sql.end();

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { logger } from "../lib/logger.ts";
import { db, sql } from "./client.ts";

await migrate(db, {
  migrationsFolder: new URL("./migrations", import.meta.url).pathname,
});
logger.info("Database migrations applied");
await sql.end();

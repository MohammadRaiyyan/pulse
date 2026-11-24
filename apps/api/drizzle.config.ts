import { defineConfig } from "drizzle-kit";

process.loadEnvFile(".env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/models/index.ts",
  out: "./src/db/migrations",
  casing: "snake_case",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});

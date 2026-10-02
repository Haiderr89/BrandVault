import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Migrations use a direct (unpooled) connection when available, e.g. Neon's
  // DATABASE_URL_UNPOOLED; the app itself uses the pooled DATABASE_URL.
  dbCredentials: { url: (process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL)! },
  strict: true,
});

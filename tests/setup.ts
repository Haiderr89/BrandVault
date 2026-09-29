import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { vi } from "vitest";
import * as schema from "@/db/schema";

// Swap the real Postgres client for an in-memory PGlite database running the
// same migrations, so the API tests need no external services.
vi.mock("@/db", async () => {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return { db };
});

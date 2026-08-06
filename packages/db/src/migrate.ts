import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb, defaultDbPath } from "./client";

export function applyMigrations(dbPath = defaultDbPath()): string {
  const db = createDb(dbPath);
  const migrationsFolder = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../migrations",
  );
  migrate(db, { migrationsFolder });
  return dbPath;
}

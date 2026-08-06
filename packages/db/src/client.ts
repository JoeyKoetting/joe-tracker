import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as schema from "./schema";

/** Repo root from packages/db/src/client.ts */
const REPO_ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

export function defaultDbPath(): string {
  return process.env.JOE_DB_PATH ?? path.join(REPO_ROOT, "data", "joe.db");
}

export function createDb(dbPath = defaultDbPath()) {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type Db = ReturnType<typeof createDb>;

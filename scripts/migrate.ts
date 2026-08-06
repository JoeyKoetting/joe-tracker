import { applyMigrations } from "@joe/db";

const dbPath = applyMigrations();
console.log(`Migrations applied → ${dbPath}`);

// db.ts — Drizzle ORM database instance (libSQL/SQLite) with automatic migrations.
import { drizzle } from "drizzle-orm/libsql/node";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema.js";
import { config } from "dotenv";
import { join } from "path";

config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env");
}

export const db = drizzle({
  connection: { url: process.env.DATABASE_URL },
  schema,
});

export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
}

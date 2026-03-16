import { drizzle } from "drizzle-orm/libsql/node";
import * as schema from "./schema.js";
import { config } from "dotenv";

config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in .env");
}

export const db = drizzle({
  connection: { url: process.env.DATABASE_URL },
  schema,
});

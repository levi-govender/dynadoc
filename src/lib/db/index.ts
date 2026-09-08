import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  dynadocDb?: Database;
  dynadocSql?: ReturnType<typeof postgres>;
};

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

export function getDb(): Database {
  if (globalForDb.dynadocDb) {
    return globalForDb.dynadocDb;
  }

  const sql = postgres(getDatabaseUrl(), { max: 1 });
  const db = drizzle(sql, { schema });

  globalForDb.dynadocSql = sql;
  globalForDb.dynadocDb = db;
  return db;
}

export function getSql() {
  getDb();
  const sql = globalForDb.dynadocSql;
  if (!sql) {
    throw new Error("DATABASE_URL is not set");
  }
  return sql;
}

export async function closeDb() {
  if (!globalForDb.dynadocSql) {
    return;
  }
  await globalForDb.dynadocSql.end({ timeout: 5 });
  globalForDb.dynadocSql = undefined;
  globalForDb.dynadocDb = undefined;
}

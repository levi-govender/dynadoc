import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_MIGRATE_URL ??
      process.env.DATABASE_URL ??
      "postgres://dynadoc:dynadoc@localhost:5432/dynadoc",
  },
});

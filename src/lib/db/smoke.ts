import { config } from "dotenv";
import { getDb } from "./index";
import { healthChecks } from "./schema";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const db = getDb();
  const rows = await db.select().from(healthChecks).limit(1);
  console.log("health_checks select ok", { count: rows.length });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

import assert from "node:assert/strict";
import { after } from "node:test";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "./index";
import { organizations, tenantRecords } from "./schema";
import { organizationEq, withOrganization } from "./tenant";

config({ path: ".env.local" });
config({ path: ".env" });

function errorText(error: unknown): string {
  if (!error || typeof error !== "object") {
    return String(error);
  }
  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.name, error.message);
  }
  if ("code" in error) {
    parts.push(String(error.code));
  }
  if ("cause" in error && error.cause) {
    parts.push(errorText(error.cause));
  }
  if ("errors" in error && Array.isArray(error.errors)) {
    for (const inner of error.errors) {
      parts.push(errorText(inner));
    }
  }
  return parts.join("\n");
}

function isPostgresUnavailable(error: unknown): boolean {
  const text = errorText(error);
  return (
    text.includes("ECONNREFUSED") ||
    (text.includes("tenant_records") && text.includes("does not exist"))
  );
}

test("org A cannot read org B tenant_records", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }

  try {
    const db = getDb();
    const [orgA] = await db
      .insert(organizations)
      .values({ externalId: `rls-a-${Date.now()}`, name: "Org A" })
      .returning({ id: organizations.id });
    const [orgB] = await db
      .insert(organizations)
      .values({ externalId: `rls-b-${Date.now()}`, name: "Org B" })
      .returning({ id: organizations.id });

    assert.ok(orgA && orgB);

    await withOrganization(orgA.id, async (scoped) => {
      await scoped.insert(tenantRecords).values({
        organizationId: orgA.id,
        note: "secret-a",
      });
    });
    await withOrganization(orgB.id, async (scoped) => {
      await scoped.insert(tenantRecords).values({
        organizationId: orgB.id,
        note: "secret-b",
      });
    });

    const aRows = await withOrganization(orgA.id, async (scoped) =>
      scoped
        .select()
        .from(tenantRecords)
        .where(organizationEq(tenantRecords.organizationId, orgA.id)),
    );
    const bRows = await withOrganization(orgB.id, async (scoped) =>
      scoped.select().from(tenantRecords),
    );

    assert.deepEqual(
      aRows.map((row) => row.note),
      ["secret-a"],
    );
    assert.deepEqual(
      bRows.map((row) => row.note),
      ["secret-b"],
    );
  } catch (error) {
    if (isPostgresUnavailable(error)) {
      t.skip("Postgres is not running or tenant_records is not migrated");
      return;
    }
    throw error;
  }
});

test("query without org context throws and does not return all rows", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }

  try {
    const db = getDb();
    const rows = await db.select().from(tenantRecords);
    assert.fail(`expected throw, got ${String(rows.length)} rows`);
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error;
    }
    if (isPostgresUnavailable(error)) {
      t.skip("Postgres is not running or tenant_records is not migrated");
      return;
    }
    assert.match(errorText(error), /app\.organization_id is required/i);
  }
});

after(async () => {
  await closeDb();
});

import assert from "node:assert/strict";
import { after } from "node:test";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { importFromJson } from "@/lib/document-types/import";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import fixture from "@/types/fixtures/employment-contract.json";
import { exportDocumentType } from "@/lib/document-types/export";

config({ path: ".env.local" });
config({ path: ".env" });

function isPostgresUnavailable(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes("ECONNREFUSED") ||
    (text.includes("document_types") && text.includes("does not exist"))
  );
}

test("family bundle creates multiple drafts under one family", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  try {
    const db = getDb();
    const stamp = Date.now();
    const snapshot = parseDocumentTypeVersionSnapshot(fixture);
    const [org] = await db
      .insert(organizations)
      .values({
        externalId: `import-fam-${stamp}`,
        name: "Import family org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);
    const result = await importFromJson({
      organizationId: org.id,
      payload: {
        kind: "family",
        name: "Contracts",
        slug: `contracts-${stamp}`,
        members: [
          { name: "A", slug: `a-${stamp}`, snapshot },
          { name: "B", slug: `b-${stamp}`, snapshot },
        ],
      },
    });
    assert.equal(result.kind, "family");
    assert.equal(result.types.length, 2);
    assert.equal(result.types[0]?.status, "draft");
    assert.ok(result.family);
    assert.equal(result.family.name, "Contracts");
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error;
    }
    if (isPostgresUnavailable(error)) {
      t.skip("Postgres is not running or schema is not migrated");
      return;
    }
    throw error;
  }
});

test("export then import creates a new draft with remapped ids", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }
  try {
    const db = getDb();
    const stamp = Date.now();
    const [org] = await db
      .insert(organizations)
      .values({
        externalId: `import-round-${stamp}`,
        name: "Import round org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);
    const snapshot = parseDocumentTypeVersionSnapshot(fixture);
    const created = await importFromJson({
      organizationId: org.id,
      payload: {
        name: "Round",
        slug: `round-${stamp}`,
        source: "draft",
        snapshot,
      },
    });
    const typeId = created.types[0]?.id;
    assert.ok(typeId);
    const exported = await exportDocumentType({
      organizationId: org.id,
      documentTypeId: typeId,
      source: "draft",
    });
    const again = await importFromJson({
      organizationId: org.id,
      payload: exported,
    });
    assert.notEqual(again.types[0]?.id, typeId);
    assert.equal(again.types[0]?.status, "draft");
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error;
    }
    if (isPostgresUnavailable(error)) {
      t.skip("Postgres is not running or schema is not migrated");
      return;
    }
    throw error;
  }
});

after(async () => {
  await closeDb();
});

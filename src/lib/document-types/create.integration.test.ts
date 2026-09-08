import assert from "node:assert/strict";
import { after } from "node:test";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import { documentTypes, organizations } from "@/lib/db/schema";
import {
  createDocumentType,
  listDocumentTypes,
} from "@/lib/document-types/create";
import { withOrganization } from "@/lib/db/tenant";

config({ path: ".env.local" });
config({ path: ".env" });

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`;
  }
  return String(error);
}

function isPostgresUnavailable(error: unknown): boolean {
  const text = errorText(error);
  return (
    text.includes("ECONNREFUSED") ||
    (text.includes("document_types") && text.includes("does not exist"))
  );
}

test("created types list only for the owning organization", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }

  try {
    const db = getDb();
    const stamp = Date.now();
    const [orgA] = await db
      .insert(organizations)
      .values({
        externalId: `create-a-${stamp}`,
        name: "Org A",
      })
      .returning({ id: organizations.id });
    const [orgB] = await db
      .insert(organizations)
      .values({
        externalId: `create-b-${stamp}`,
        name: "Org B",
      })
      .returning({ id: organizations.id });
    assert.ok(orgA && orgB);

    const created = await createDocumentType({
      organizationId: orgA.id,
      name: "Employment contract",
      slug: `employment-${stamp}`,
    });
    assert.equal(created.organizationId, orgA.id);

    const listA = await listDocumentTypes(orgA.id);
    const listB = await listDocumentTypes(orgB.id);
    assert.ok(listA.some((row) => row.id === created.id));
    assert.equal(
      listB.some((row) => row.id === created.id),
      false,
    );

    const [row] = await withOrganization(orgA.id, async (scoped) =>
      scoped
        .select({ slug: documentTypes.slug })
        .from(documentTypes)
        .where(eq(documentTypes.id, created.id)),
    );
    assert.equal(row?.slug, `employment-${stamp}`);
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

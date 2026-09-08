import assert from "node:assert/strict";
import { after } from "node:test";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import { organizations, user } from "@/lib/db/schema";
import { createDocumentType } from "@/lib/document-types/create";
import {
  exportDocumentType,
  parseDocumentTypeExport,
  snapshotFromExport,
} from "@/lib/document-types/export";
import {
  DocumentTypeNotFoundError,
  UnpublishedTypeError,
  publishDocumentType,
  saveDraft,
} from "@/lib/document-types/versions";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import fixture from "@/types/fixtures/employment-contract.json";

config({ path: ".env.local" });
config({ path: ".env" });

function isPostgresUnavailable(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes("ECONNREFUSED") ||
    (text.includes("document_types") && text.includes("does not exist"))
  );
}

test("export is org-scoped and published JSON is not the later draft", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }

  try {
    const db = getDb();
    const stamp = Date.now();
    const snapshot = parseDocumentTypeVersionSnapshot(fixture);
    const [orgA] = await db
      .insert(organizations)
      .values({
        externalId: `export-a-${stamp}`,
        name: "Export A",
      })
      .returning({ id: organizations.id });
    const [orgB] = await db
      .insert(organizations)
      .values({
        externalId: `export-b-${stamp}`,
        name: "Export B",
      })
      .returning({ id: organizations.id });
    assert.ok(orgA && orgB);

    const [author] = await db
      .insert(user)
      .values({
        id: `export-user-${stamp}`,
        name: "Exporter",
        email: `export-${stamp}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    assert.ok(author);

    const created = await createDocumentType({
      organizationId: orgA.id,
      name: "Exportable",
      slug: `exportable-${stamp}`,
    });
    await saveDraft({
      organizationId: orgA.id,
      documentTypeId: created.id,
      snapshot,
    });

    const draftExport = await exportDocumentType({
      organizationId: orgA.id,
      documentTypeId: created.id,
      source: "draft",
    });
    assert.equal(draftExport.source, "draft");
    assert.deepEqual(
      snapshotFromExport(parseDocumentTypeExport(JSON.parse(JSON.stringify(draftExport)))),
      snapshot,
    );

    await assert.rejects(
      () =>
        exportDocumentType({
          organizationId: orgB.id,
          documentTypeId: created.id,
          source: "draft",
        }),
      DocumentTypeNotFoundError,
    );

    await publishDocumentType({
      organizationId: orgA.id,
      documentTypeId: created.id,
      publishedBy: author.id,
    });
    await saveDraft({
      organizationId: orgA.id,
      documentTypeId: created.id,
      snapshot: {
        ...snapshot,
        formSchema: {
          ...snapshot.formSchema,
          groups: snapshot.formSchema.groups.map((group, index) =>
            index === 0 ? { ...group, title: "Draft after export publish" } : group,
          ),
        },
      },
    });

    const publishedExport = await exportDocumentType({
      organizationId: orgA.id,
      documentTypeId: created.id,
      source: "published",
    });
    assert.equal(
      publishedExport.snapshot.formSchema.groups[0]?.title,
      snapshot.formSchema.groups[0]?.title,
    );
    assert.notEqual(
      publishedExport.snapshot.formSchema.groups[0]?.title,
      "Draft after export publish",
    );
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

test("unpublished types cannot export a published snapshot", async (t) => {
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
        externalId: `export-unpub-${stamp}`,
        name: "Unpublished export",
      })
      .returning({ id: organizations.id });
    assert.ok(org);
    const created = await createDocumentType({
      organizationId: org.id,
      name: "Unpublished",
      slug: `unpub-export-${stamp}`,
    });
    await assert.rejects(
      () =>
        exportDocumentType({
          organizationId: org.id,
          documentTypeId: created.id,
          source: "published",
        }),
      UnpublishedTypeError,
    );
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

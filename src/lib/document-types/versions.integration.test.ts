import assert from "node:assert/strict";
import { after } from "node:test";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import {
  documentTypeVersions,
  documentTypes,
  organizations,
  user,
} from "@/lib/db/schema";
import { withOrganization } from "@/lib/db/tenant";
import {
  createInstanceFromPublished,
  publishDocumentType,
  saveDraft,
} from "@/lib/document-types/versions";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import fixture from "@/types/fixtures/employment-contract.json";

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
  return parts.join("\n");
}

function isPostgresUnavailable(error: unknown): boolean {
  const text = errorText(error);
  return (
    text.includes("ECONNREFUSED") ||
    (text.includes("document_types") && text.includes("does not exist")) ||
    text.includes("draft_snapshot")
  );
}

test("publish freezes a version; later draft edits do not change generate JSON", async (t) => {
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
        externalId: `publish-${stamp}`,
        name: "Publish org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);

    const [author] = await db
      .insert(user)
      .values({
        id: `publish-user-${stamp}`,
        name: "Publisher",
        email: `publish-${stamp}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    assert.ok(author);

    const [type] = await withOrganization(org.id, async (scoped) =>
      scoped
        .insert(documentTypes)
        .values({
          organizationId: org.id,
          slug: `employment-${stamp}`,
          name: "Employment",
        })
        .returning({ id: documentTypes.id }),
    );
    assert.ok(type);

    await saveDraft({
      organizationId: org.id,
      documentTypeId: type.id,
      snapshot,
    });

    const published = await publishDocumentType({
      organizationId: org.id,
      documentTypeId: type.id,
      publishedBy: author.id,
    });
    assert.equal(published.version.versionNumber, 1);
    assert.ok(published.type.publishedAt);
    assert.equal(published.type.publishedBy, author.id);

    await saveDraft({
      organizationId: org.id,
      documentTypeId: type.id,
      snapshot: {
        ...snapshot,
        formSchema: {
          ...snapshot.formSchema,
          groups: snapshot.formSchema.groups.map((group, index) =>
            index === 0 ? { ...group, title: "Draft after publish" } : group,
          ),
        },
      },
    });

    const generated = await createInstanceFromPublished({
      organizationId: org.id,
      documentTypeId: type.id,
      createdBy: author.id,
      answers: {},
    });
    assert.equal(
      generated.snapshot.formSchema.groups[0]?.title,
      snapshot.formSchema.groups[0]?.title,
    );
    assert.equal(generated.version.id, published.version.id);

    const [versionRow] = await withOrganization(org.id, async (scoped) =>
      scoped
        .select()
        .from(documentTypeVersions)
        .where(eq(documentTypeVersions.id, published.version.id)),
    );
    const formSchema = versionRow?.formSchema as {
      groups?: { title?: string }[];
    };
    assert.equal(
      formSchema.groups?.[0]?.title,
      snapshot.formSchema.groups[0]?.title,
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

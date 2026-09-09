import assert from "node:assert/strict";
import { after } from "node:test";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import {
  documentTypes,
  instances,
  organizations,
  user,
} from "@/lib/db/schema";
import { withOrganization } from "@/lib/db/tenant";
import { attachIssuedPdfKey } from "@/lib/document-types/instances";
import { issuedPdfObjectKey } from "@/lib/pdf/issue";
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

test("draft edits after issue do not change the stored resolved AST", async (t) => {
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
        externalId: `instance-${stamp}`,
        name: "Instance org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);

    const [author] = await db
      .insert(user)
      .values({
        id: `instance-user-${stamp}`,
        name: "Issuer",
        email: `instance-${stamp}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    assert.ok(author);

    const [type] = await withOrganization(org.id, async (scoped) =>
      scoped
        .insert(documentTypes)
        .values({
          organizationId: org.id,
          slug: `instance-employment-${stamp}`,
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
    await publishDocumentType({
      organizationId: org.id,
      documentTypeId: type.id,
      publishedBy: author.id,
    });

    const generated = await createInstanceFromPublished({
      organizationId: org.id,
      documentTypeId: type.id,
      createdBy: author.id,
      answers: {
        employmentType: "contractor",
        jobTitle: "Engineer",
        startDate: "2026-04-01",
      },
    });
    const frozen = JSON.stringify(generated.instance.resolvedAst);

    await saveDraft({
      organizationId: org.id,
      documentTypeId: type.id,
      snapshot: {
        ...snapshot,
        template: {
          ...snapshot.template,
          blocks: snapshot.template.blocks.map((block) =>
            block.id === "title"
              ? {
                  ...block,
                  children: [{ type: "text", text: "Rewritten after issue" }],
                }
              : block,
          ),
        },
      },
    });

    const [row] = await withOrganization(org.id, async (scoped) =>
      scoped
        .select()
        .from(instances)
        .where(eq(instances.id, generated.instance.id)),
    );
    assert.ok(row);
    assert.equal(JSON.stringify(row.resolvedAst), frozen);
    assert.equal(row.documentTypeVersionId, generated.version.id);
    assert.equal(row.createdBy, author.id);

    await attachIssuedPdfKey({
      organizationId: org.id,
      instanceId: generated.instance.id,
      objectKey: "s3://first.pdf",
    });
    await attachIssuedPdfKey({
      organizationId: org.id,
      instanceId: generated.instance.id,
      objectKey: "s3://second.pdf",
    });
    const [issued] = await withOrganization(org.id, async (scoped) =>
      scoped
        .select()
        .from(instances)
        .where(eq(instances.id, generated.instance.id)),
    );
    assert.equal(issued?.issuedPdfKey, "s3://first.pdf");
    assert.equal(JSON.stringify(issued?.resolvedAst), frozen);
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

test("two generates insert two instance rows with distinct PDF keys", async (t) => {
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
        externalId: `regen-${stamp}`,
        name: "Regen org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);

    const [author] = await db
      .insert(user)
      .values({
        id: `regen-user-${stamp}`,
        name: "Regen",
        email: `regen-${stamp}@example.com`,
        emailVerified: true,
      })
      .returning({ id: user.id });
    assert.ok(author);

    const [type] = await withOrganization(org.id, async (scoped) =>
      scoped
        .insert(documentTypes)
        .values({
          organizationId: org.id,
          slug: `regen-employment-${stamp}`,
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
    await publishDocumentType({
      organizationId: org.id,
      documentTypeId: type.id,
      publishedBy: author.id,
    });

    const answers = {
      employmentType: "contractor" as const,
      jobTitle: "Engineer",
      startDate: "2026-04-01",
    };
    const first = await createInstanceFromPublished({
      organizationId: org.id,
      documentTypeId: type.id,
      createdBy: author.id,
      answers,
    });
    const second = await createInstanceFromPublished({
      organizationId: org.id,
      documentTypeId: type.id,
      createdBy: author.id,
      answers,
    });
    assert.notEqual(first.instance.id, second.instance.id);

    const firstKey = issuedPdfObjectKey({
      organizationId: org.id,
      documentTypeId: type.id,
      instanceId: first.instance.id,
    });
    const secondKey = issuedPdfObjectKey({
      organizationId: org.id,
      documentTypeId: type.id,
      instanceId: second.instance.id,
    });
    assert.notEqual(firstKey, secondKey);

    await attachIssuedPdfKey({
      organizationId: org.id,
      instanceId: first.instance.id,
      objectKey: firstKey,
    });
    await attachIssuedPdfKey({
      organizationId: org.id,
      instanceId: second.instance.id,
      objectKey: secondKey,
    });

    const rows = await withOrganization(org.id, async (scoped) =>
      scoped
        .select()
        .from(instances)
        .where(eq(instances.documentTypeVersionId, first.version.id)),
    );
    assert.equal(rows.length, 2);
    const keys = new Set(rows.map((row) => row.issuedPdfKey));
    assert.equal(keys.size, 2);
    assert.ok(keys.has(firstKey));
    assert.ok(keys.has(secondKey));
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

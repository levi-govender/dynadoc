import assert from "node:assert/strict";
import { after } from "node:test";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "./index";
import {
  documentTypeVersions,
  documentTypes,
  instances,
  organizations,
} from "./schema";
import { withOrganization } from "./tenant";

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
    (text.includes("document_types") && text.includes("does not exist"))
  );
}

test("foreign keys prevent orphan instances", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not set");
    return;
  }

  try {
    const db = getDb();
    const [org] = await db
      .insert(organizations)
      .values({
        externalId: `fk-${Date.now()}`,
        name: "FK org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);

    const missingVersionId = "00000000-0000-0000-0000-000000000001";

    await assert.rejects(
      () =>
        withOrganization(org.id, async (scoped) =>
          scoped.insert(instances).values({
            organizationId: org.id,
            documentTypeVersionId: missingVersionId,
            answers: {},
            resolvedAst: {},
          }),
        ),
      (error: unknown) =>
        /foreign key|document_type_version/i.test(errorText(error)),
    );

    const [type] = await withOrganization(org.id, async (scoped) =>
      scoped
        .insert(documentTypes)
        .values({
          organizationId: org.id,
          slug: `type-${Date.now()}`,
          name: "Employment",
        })
        .returning({ id: documentTypes.id }),
    );
    assert.ok(type);

    const [version] = await withOrganization(org.id, async (scoped) =>
      scoped
        .insert(documentTypeVersions)
        .values({
          organizationId: org.id,
          documentTypeId: type.id,
          versionNumber: 1,
          formSchema: {},
          template: {},
          styleTheme: {},
        })
        .returning({ id: documentTypeVersions.id }),
    );
    assert.ok(version);

    const [instance] = await withOrganization(org.id, async (scoped) =>
      scoped
        .insert(instances)
        .values({
          organizationId: org.id,
          documentTypeVersionId: version.id,
          answers: { ok: true },
          resolvedAst: { blocks: [] },
        })
        .returning({ id: instances.id }),
    );
    assert.ok(instance);
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

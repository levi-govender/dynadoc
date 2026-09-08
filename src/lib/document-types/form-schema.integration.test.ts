import assert from "node:assert/strict";
import { after } from "node:test";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { createDocumentType } from "@/lib/document-types/create";
import { addField, setFieldRequired } from "@/lib/document-types/form-schema";
import {
  getDocumentType,
  saveDraft,
} from "@/lib/document-types/versions";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";

config({ path: ".env.local" });
config({ path: ".env" });

function isPostgresUnavailable(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return (
    text.includes("ECONNREFUSED") ||
    (text.includes("document_types") && text.includes("does not exist"))
  );
}

test("required flag round-trips on the draft snapshot", async (t) => {
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
        externalId: `fields-${stamp}`,
        name: "Fields org",
      })
      .returning({ id: organizations.id });
    assert.ok(org);

    const created = await createDocumentType({
      organizationId: org.id,
      name: "Employment",
      slug: `employment-fields-${stamp}`,
    });
    const snapshot = parseDocumentTypeVersionSnapshot(created.draftSnapshot);
    const groupId = snapshot.formSchema.groups[0]?.id ?? "";
    let form = addField(snapshot.formSchema, groupId, "text");
    const fieldId = form.groups[0]?.fields[0]?.id ?? "";
    form = setFieldRequired(form, groupId, fieldId, true);

    await saveDraft({
      organizationId: org.id,
      documentTypeId: created.id,
      snapshot: { ...snapshot, formSchema: form },
    });

    const reloaded = await getDocumentType({
      organizationId: org.id,
      documentTypeId: created.id,
    });
    const again = parseDocumentTypeVersionSnapshot(reloaded.draftSnapshot);
    const field = again.formSchema.groups[0]?.fields[0];
    assert.equal(field?.id, fieldId);
    assert.equal(field?.required, true);
    assert.equal(field?.label, "Untitled field");
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

import assert from "node:assert/strict";
import { after } from "node:test";
import { config } from "dotenv";
import test from "node:test";
import { closeDb, getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { createDocumentType } from "@/lib/document-types/create";
import { addField, setFieldRequired } from "@/lib/document-types/form-schema";
import { addBlock, setBlockText } from "@/lib/document-types/template";
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

    let template = addBlock(snapshot.template, "signature");
    const signatureId = template.blocks.at(-1)?.id ?? "";
    const headingId = template.blocks[0]?.id ?? "";
    template = setBlockText(template, headingId, "Persisted heading");
    await saveDraft({
      organizationId: org.id,
      documentTypeId: created.id,
      snapshot: { ...snapshot, formSchema: form, template },
    });
    const withBlocks = parseDocumentTypeVersionSnapshot(
      (
        await getDocumentType({
          organizationId: org.id,
          documentTypeId: created.id,
        })
      ).draftSnapshot,
    );
    const headingChild = withBlocks.template.blocks[0]?.children?.[0];
    assert.equal(headingChild?.type, "text");
    assert.equal(
      headingChild && headingChild.type === "text" ? headingChild.text : "",
      "Persisted heading",
    );
    assert.equal(withBlocks.template.blocks.at(-1)?.id, signatureId);
    assert.equal(withBlocks.template.blocks.at(-1)?.type, "signature");
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

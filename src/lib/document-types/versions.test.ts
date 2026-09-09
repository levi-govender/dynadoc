import assert from "node:assert/strict";
import test from "node:test";
import { toAuthzResponse } from "@/lib/auth/authz";
import {
  PublishedVersionImmutableError,
  assertPublishedVersionImmutable,
  parseInstanceGenerateBody,
  snapshotForOperatorGenerate,
} from "./versions";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import fixture from "@/types/fixtures/employment-contract.json";

test("operator generate uses published snapshot even if draft changed", () => {
  const published = parseDocumentTypeVersionSnapshot(fixture);
  const draft = parseDocumentTypeVersionSnapshot({
    ...published,
    formSchema: {
      ...published.formSchema,
      groups: published.formSchema.groups.map((group, index) =>
        index === 0 ? { ...group, title: "Changed draft title" } : group,
      ),
    },
  });
  const used = snapshotForOperatorGenerate({ published, draft });
  assert.equal(
    used.formSchema.groups[0]?.title,
    published.formSchema.groups[0]?.title,
  );
  assert.notEqual(used.formSchema.groups[0]?.title, "Changed draft title");
});

test("generate body fromDraft is only true when the flag is boolean true", () => {
  assert.deepEqual(parseInstanceGenerateBody(null), {
    answers: {},
    fromDraft: false,
  });
  assert.deepEqual(parseInstanceGenerateBody({ answers: { a: 1 } }), {
    answers: { a: 1 },
    fromDraft: false,
  });
  assert.equal(
    parseInstanceGenerateBody({ fromDraft: true, answers: { a: 1 } }).fromDraft,
    true,
  );
  assert.equal(parseInstanceGenerateBody({ fromDraft: "true" }).fromDraft, false);
});

test("published version JSON cannot be mutated via API helper", () => {
  assert.throws(
    () => assertPublishedVersionImmutable(),
    PublishedVersionImmutableError,
  );
  try {
    assertPublishedVersionImmutable();
  } catch (error) {
    const response = toAuthzResponse(error);
    assert.equal(response?.status, 409);
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  documentTypeErrorStatus,
  snapshotForOperatorGenerate,
  UnpublishedTypeError,
} from "@/lib/document-types/versions";
import { buildDraftTreeSnapshot } from "./draft-tree";
import {
  applyIngestReview,
  diffAgainstEmptyDraft,
  omitRejectedTemplateBlocks,
} from "./review";

test("rejecting a clause leaves it out of the template", () => {
  const snapshot = buildDraftTreeSnapshot({
    name: "Employment",
    texts: [
      "The employee is employed full time.\n\nSalary is R20 000 per month.",
    ],
  });
  const salary = snapshot.template.blocks.find((block) => {
    const child = block.children?.[0];
    return child?.type === "text" && /salary/i.test(child.text);
  });
  assert.ok(salary);
  const reviewed = omitRejectedTemplateBlocks(snapshot, [salary.id]);
  assert.equal(
    reviewed.template.blocks.some((block) => block.id === salary.id),
    false,
  );
  const added = diffAgainstEmptyDraft(snapshot).filter(
    (row) => row.vsEmpty === "added",
  );
  assert.ok(added.length > 0);
});

test("applyIngestReview does not mark the family published", () => {
  const snapshot = buildDraftTreeSnapshot({
    name: "Employment",
    texts: ["Notice period is four weeks."],
  });
  const family = applyIngestReview({
    familyDraft: {
      kind: "family",
      name: "Ingest family draft",
      slug: "ingest-family-draft",
      members: [{ name: "Employment", slug: "employment", snapshot }],
    },
    rejectedBlockIds: [],
  });
  assert.equal(family.kind, "family");
  assert.equal(family.members.length, 1);
});

test("operators cannot generate until a type is published", () => {
  assert.equal(documentTypeErrorStatus(new UnpublishedTypeError()), 409);
  const published = buildDraftTreeSnapshot({
    name: "Published",
    texts: ["Published clause."],
  });
  const draft = buildDraftTreeSnapshot({
    name: "Draft only",
    texts: ["Secret draft clause."],
  });
  const used = snapshotForOperatorGenerate({ published, draft });
  assert.equal(used.template.blocks[0]?.children?.[0]?.type, "text");
  if (used.template.blocks[0]?.children?.[0]?.type === "text") {
    assert.match(used.template.blocks[0].children[0].text, /Published/);
  }
});

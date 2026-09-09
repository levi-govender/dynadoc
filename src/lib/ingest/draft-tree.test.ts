import assert from "node:assert/strict";
import test from "node:test";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import { buildDraftTreeSnapshot, clauseSlot, segmentClauses } from "./draft-tree";

test("two salary-clause wordings become a variant map, not two unbound paragraphs", () => {
  const snapshot = buildDraftTreeSnapshot({
    name: "Employment",
    texts: [
      "The employee is employed full time.\n\nSalary is R20 000 per month.",
      "The employee is employed full time.\n\nRemuneration is R45 000 per month.",
    ],
  });
  parseDocumentTypeVersionSnapshot(snapshot);
  const salaryParas = snapshot.template.blocks.filter((block) => {
    const child = block.children?.[0];
    return (
      block.type === "paragraph" &&
      ((child?.type === "text" && /salary|remuneration/i.test(child.text)) ||
        child?.type === "variantMap")
    );
  });
  const maps = snapshot.template.blocks.flatMap((block) =>
    (block.children ?? []).filter((child) => child.type === "variantMap"),
  );
  assert.equal(maps.length, 1);
  assert.equal(maps[0]?.type, "variantMap");
  if (maps[0]?.type === "variantMap") {
    assert.equal(Object.keys(maps[0].variants).length, 2);
    assert.equal(maps[0].field, "salaryWording");
  }
  assert.equal(salaryParas.length, 1);
  const select = snapshot.formSchema.groups
    .flatMap((group) => group.fields)
    .find((field) => field.id === "salaryWording");
  assert.equal(select?.type, "select");
});

test("segmentClauses splits numbered and blank-line clauses", () => {
  assert.equal(clauseSlot("Salary is R1"), "salary");
  assert.ok(segmentClauses("A.\n\nB clause").length >= 2);
});

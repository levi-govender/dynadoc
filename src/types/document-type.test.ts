import assert from "node:assert/strict";
import test from "node:test";
import {
  documentTypeVersionJsonSchema,
  exprSchema,
  parseDocumentTypeVersionSnapshot,
} from "./document-type";
import fixture from "./fixtures/employment-contract.json";

test("Zod parses a sample employment-contract fixture", () => {
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.formSchema.groups[0]?.fields[0]?.type, "select");
  const options =
    snapshot.formSchema.groups[0]?.fields[0]?.type === "select"
      ? snapshot.formSchema.groups[0].fields[0].options
      : [];
  assert.deepEqual(options[0]?.activatesGroupIds, ["permanentTerms"]);
});

test("invalid expr fails parse", () => {
  assert.throws(() =>
    exprSchema.parse({ op: "js", code: "employmentType === 'permanent'" }),
  );
  assert.throws(() => exprSchema.parse({ op: "eq", field: "employmentType" }));
  assert.throws(() => exprSchema.parse("employmentType == permanent"));
});

test("snapshot exports JSON Schema for import validation", () => {
  const jsonSchema = documentTypeVersionJsonSchema();
  assert.equal(typeof jsonSchema, "object");
  assert.ok(jsonSchema);
});

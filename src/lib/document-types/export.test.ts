import assert from "node:assert/strict";
import test from "node:test";
import fixture from "@/types/fixtures/employment-contract.json";
import { parseDocumentTypeVersionSnapshot } from "@/types/document-type";
import {
  parseDocumentTypeExport,
  snapshotFromExport,
} from "./export";

test("exported fixture JSON round-trips through the import parser", () => {
  const snapshot = parseDocumentTypeVersionSnapshot(fixture);
  const exported = parseDocumentTypeExport({
    name: "Employment",
    slug: "employment",
    source: "draft",
    snapshot,
  });
  const json = JSON.parse(JSON.stringify(exported)) as unknown;
  const again = parseDocumentTypeExport(json);
  assert.deepEqual(snapshotFromExport(again), snapshot);
  assert.equal(again.snapshot.formSchema.groups[0]?.id, "agreement");
  assert.equal(again.snapshot.template.blocks[0]?.id, "title");
});
